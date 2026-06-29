/**
 * Aether mDNS / Network Discovery
 * Scans local network for Aether instances via common IP ranges and known ports.
 * Falls back to manual entry or QR code if no instance is found.
 */

const AETHER_PORT = 8765;
const DISCOVERY_TIMEOUT = 3000; // ms per host probe
const SCAN_CONCURRENCY = 20;   // parallel probes

/**
 * Probe a single host:port combo to see if Aether is running there.
 * Uses WebSocket handshake — if it connects and sends a valid identity message, we found it.
 */
async function probeHost(host, port = AETHER_PORT) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ws.close();
      resolve(null);
    }, DISCOVERY_TIMEOUT);

    let ws;
    try {
      ws = new WebSocket(`ws://${host}:${port}`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      };

      ws.onmessage = (event) => {
        clearTimeout(timer);
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pong' || msg.type === 'identity' || msg.type === 'heartbeat') {
            resolve({
              host,
              port,
              address: `${host}:${port}`,
              name: msg.payload?.name || 'Aether',
              version: msg.payload?.version || 'unknown',
              model: msg.payload?.model || 'unknown',
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };

      ws.onclose = () => {
        clearTimeout(timer);
      };
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * Get the local subnet based on common home/office ranges.
 * Returns the base IPs to scan (e.g. "192.168.1" → scan .1–.254).
 */
function getLocalSubnets() {
  // In a browser/web context we can't get the actual local IP,
  // so we scan the most common home network subnets.
  return [
    '192.168.1',
    '192.168.0',
    '192.168.50',
    '10.0.0',
    '10.0.1',
    '172.16.0',
  ];
}

/**
 * Generate candidate host IPs to probe.
 * Prioritizes .1 (router) and low numbers (.2-.20) which are common for servers/dev machines.
 */
function getCandidateHosts() {
  const candidates = [];
  const subnets = getLocalSubnets();

  for (const subnet of subnets) {
    // Prioritize common static assignments
    for (const last of [1, 2, 10, 100, 42, 50, 200]) {
      candidates.push(`${subnet}.${last}`);
    }
  }

  // Add localhost variants
  candidates.unshift('localhost', '127.0.0.1');

  return candidates;
}

/**
 * Scan local network for Aether backend.
 * @param {function} onProgress - called with { found, scanned, total, host }
 * @param {AbortSignal} signal - to cancel scan
 * @returns {Promise<Array>} found instances
 */
export async function discoverAetherInstances(onProgress, signal) {
  const candidates = getCandidateHosts();
  const found = [];
  let scanned = 0;

  const chunks = [];
  for (let i = 0; i < candidates.length; i += SCAN_CONCURRENCY) {
    chunks.push(candidates.slice(i, i + SCAN_CONCURRENCY));
  }

  for (const chunk of chunks) {
    if (signal?.aborted) break;

    const results = await Promise.all(
      chunk.map(host => probeHost(host, AETHER_PORT))
    );

    for (let i = 0; i < results.length; i++) {
      scanned++;
      const result = results[i];
      if (result) {
        found.push(result);
        onProgress?.({ found: found.length, scanned, total: candidates.length, host: result });
      } else {
        onProgress?.({ found: found.length, scanned, total: candidates.length, host: null });
      }
    }

    // Short pause between chunks to avoid overwhelming the network
    await new Promise(r => setTimeout(r, 50));
  }

  return found;
}

/**
 * Quick probe — check if a specific host:port has Aether running.
 */
export async function probeSpecificHost(host, port = 8765) {
  return probeHost(host, port);
}

/**
 * Parse a QR code payload from the Aether desktop app.
 * Format: "aether://connect?host=192.168.1.42&port=8765&token=abc123"
 */
export function parseAetherQRCode(qrContent) {
  try {
    if (!qrContent.startsWith('aether://')) {
      throw new Error('Not an Aether QR code');
    }

    const url = new URL(qrContent.replace('aether://', 'https://'));
    const params = url.searchParams;

    return {
      host: params.get('host'),
      port: params.get('port') || '8765',
      token: params.get('token') || null,
      name: params.get('name') || 'Aether',
    };
  } catch (err) {
    throw new Error(`Invalid Aether QR code: ${err.message}`);
  }
}