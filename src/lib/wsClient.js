/**
 * Aether WebSocket Client
 * Real-time bidirectional communication with the Aether backend.
 * Handles auto-reconnect, heartbeat, message queuing, and event dispatch.
 */

import useAetherStore, { CONNECTION_STATUS, NODE_STATUS, VOICE_STATE } from './aetherStore';

const HEARTBEAT_INTERVAL = 15000; // 15s
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = 10;

class AetherWSClient {
  constructor() {
    this.ws = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.messageQueue = [];
    this.isManualClose = false;
    this.currentHost = null;
    this.listeners = new Map(); // eventType -> Set<callback>
  }

  // ─── Connect ───────────────────────────────────────────────────────────────
  connect(host, port = '8765') {
    this.isManualClose = false;
    this.currentHost = `${host}:${port}`;
    const url = `ws://${host}:${port}`;

    const store = useAetherStore.getState();
    store.setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    try {
      this.ws = new WebSocket(url);
      this._setupHandlers();
    } catch (err) {
      console.error('[AetherWS] Connection error:', err);
      store.setConnectionStatus(CONNECTION_STATUS.ERROR);
    }
  }

  // ─── Disconnect ────────────────────────────────────────────────────────────
  disconnect() {
    this.isManualClose = true;
    this._clearTimers();
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
    useAetherStore.getState().setDisconnected();
  }

  // ─── Send ──────────────────────────────────────────────────────────────────
  send(type, payload = {}) {
    const message = JSON.stringify({ type, payload, timestamp: Date.now() });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      // Queue for reconnect
      this.messageQueue.push(message);
      if (this.messageQueue.length > 50) this.messageQueue.shift();
    }
  }

  // ─── Event Listeners ───────────────────────────────────────────────────────
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.listeners.get(eventType)?.delete(callback);
  }

  emit(eventType, data) {
    this.listeners.get(eventType)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error('[AetherWS] Listener error:', e); }
    });
    this.listeners.get('*')?.forEach(cb => {
      try { cb({ type: eventType, data }); } catch (e) {}
    });
  }

  // ─── Private: Setup WebSocket Handlers ─────────────────────────────────────
  _setupHandlers() {
    const store = useAetherStore.getState;

    this.ws.onopen = () => {
      console.log('[AetherWS] Connected to', this.currentHost);
      store().setConnected(this.currentHost);
      this._startHeartbeat();
      this._flushQueue();
      this.emit('connected', { host: this.currentHost });
    };

    this.ws.onclose = (event) => {
      console.log('[AetherWS] Closed:', event.code, event.reason);
      this._clearTimers();
      store().setDisconnected();
      this.emit('disconnected', { code: event.code, reason: event.reason });

      if (!this.isManualClose) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      console.error('[AetherWS] Error:', err);
      store().setConnectionStatus(CONNECTION_STATUS.ERROR);
      this.emit('error', err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch (err) {
        console.error('[AetherWS] Parse error:', err);
      }
    };
  }

  // ─── Private: Handle Incoming Messages ────────────────────────────────────
  _handleMessage(msg) {
    const store = useAetherStore.getState();
    store().updateHeartbeat();

    switch (msg.type) {
      // ── Heartbeat ──
      case 'pong':
      case 'heartbeat':
        break;

      // ── Activity & Status ──
      case 'status_update':
        store().setCurrentActivity(msg.payload?.activity);
        if (msg.payload?.token_usage) store().updateTokenUsage(msg.payload.token_usage);
        if (msg.payload?.memory_count !== undefined) store().updateMemoryCount(msg.payload.memory_count);
        break;

      // ── Execution Nodes ──
      case 'node_start':
        store().addExecutionNode({
          id: msg.payload.node_id,
          name: msg.payload.name,
          type: msg.payload.type || 'generic',
          status: NODE_STATUS.THINKING,
          content: '',
          timestamp: new Date().toISOString(),
        });
        break;

      case 'node_update':
        store().updateExecutionNode(msg.payload.node_id, {
          content: msg.payload.content,
          status: msg.payload.status || NODE_STATUS.THINKING,
        });
        break;

      case 'node_complete':
        store().updateExecutionNode(msg.payload.node_id, {
          status: NODE_STATUS.COMPLETE,
          result: msg.payload.result,
          completedAt: new Date().toISOString(),
        });
        break;

      case 'node_error':
        store().updateExecutionNode(msg.payload.node_id, {
          status: NODE_STATUS.ERROR,
          error: msg.payload.error,
        });
        break;

      // ── Streaming Tokens ──
      case 'stream_token':
        store().appendExecutionLog(msg.payload.token);
        break;

      // ── Goal Events ──
      case 'goal_started':
        store().setCurrentActivity(`Executing: ${msg.payload.goal_text}`);
        break;

      case 'goal_complete':
        store().completeExecution(msg.payload.result);
        store().setCurrentActivity('Ready');
        break;

      case 'goal_interrupted':
        store().completeExecution(null);
        store().setCurrentActivity('Goal interrupted');
        break;

      // ── Tool Approval Requests ──
      case 'approval_required':
        store().addPendingApproval({
          id: msg.payload.request_id,
          toolName: msg.payload.tool_name,
          action: msg.payload.action_description,
          reason: msg.payload.reason,
          riskLevel: msg.payload.risk_level || 'medium',
        });
        break;

      // ── Voice ──
      case 'voice_transcript':
        store().addVoiceTranscript({
          role: msg.payload.role,
          text: msg.payload.text,
        });
        break;

      case 'voice_state':
        store().setVoiceState(msg.payload.state);
        break;

      // ── Memory ──
      case 'memory_update':
        if (msg.payload.memories) store().setMemories(msg.payload.memories);
        if (msg.payload.count !== undefined) store().updateMemoryCount(msg.payload.count);
        break;

      // ── Models ──
      case 'models_list':
        store().setAvailableModels(msg.payload.models || []);
        break;

      // ── Self-Improvement ──
      case 'lesson_learned':
        store().addImprovementEntry(msg.payload);
        break;

      default:
        console.log('[AetherWS] Unknown message type:', msg.type, msg);
    }

    this.emit(msg.type, msg.payload);
    this.emit('message', msg);
  }

  // ─── Private: Heartbeat ────────────────────────────────────────────────────
  _startHeartbeat() {
    this._clearTimers();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  // ─── Private: Reconnect ────────────────────────────────────────────────────
  _scheduleReconnect() {
    const store = useAetherStore.getState();
    const attempts = store().reconnectAttempts;

    if (attempts >= RECONNECT_MAX_ATTEMPTS) {
      console.log('[AetherWS] Max reconnect attempts reached');
      store().setConnectionStatus(CONNECTION_STATUS.ERROR);
      return;
    }

    store().incrementReconnectAttempts();
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, attempts),
      RECONNECT_MAX_DELAY
    );

    console.log(`[AetherWS] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
    store().setConnectionStatus(CONNECTION_STATUS.CONNECTING);

    this.reconnectTimer = setTimeout(() => {
      if (this.currentHost && !this.isManualClose) {
        const [host, port] = this.currentHost.split(':');
        this.connect(host, port);
      }
    }, delay);
  }

  // ─── Private: Flush queue ─────────────────────────────────────────────────
  _flushQueue() {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      this.ws.send(msg);
    }
  }

  // ─── Private: Clear timers ────────────────────────────────────────────────
  _clearTimers() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ─── Goal Commands ─────────────────────────────────────────────────────────
  submitGoal(goalText) {
    const store = useAetherStore.getState();
    const goal = store().submitGoal(goalText);
    this.send('goal_submit', { goal_text: goalText, goal_id: goal.id });
    return goal;
  }

  pauseGoal() {
    useAetherStore.getState().pauseExecution();
    this.send('goal_pause', {});
  }

  resumeGoal() {
    useAetherStore.getState().resumeExecution();
    this.send('goal_resume', {});
  }

  interruptGoal() {
    useAetherStore.getState().clearExecution();
    this.send('goal_interrupt', {});
  }

  // ─── Approval Commands ─────────────────────────────────────────────────────
  approveAction(requestId, reason = '') {
    useAetherStore.getState().resolveApproval(requestId, 'approved', reason);
    this.send('approval_response', { request_id: requestId, outcome: 'approved', reason });
  }

  denyAction(requestId, reason = '') {
    useAetherStore.getState().resolveApproval(requestId, 'denied', reason);
    this.send('approval_response', { request_id: requestId, outcome: 'denied', reason });
  }

  // ─── Memory Commands ───────────────────────────────────────────────────────
  fetchMemories(filters = {}) {
    this.send('memory_fetch', filters);
  }

  triggerReflection() {
    this.send('trigger_reflection', {});
  }

  deleteMemory(memoryId) {
    useAetherStore.getState().deleteMemory(memoryId);
    this.send('memory_delete', { memory_id: memoryId });
  }

  updateMemoryImportance(memoryId, importance) {
    useAetherStore.getState().updateMemoryImportance(memoryId, importance);
    this.send('memory_update_importance', { memory_id: memoryId, importance });
  }

  // ─── Voice Commands ────────────────────────────────────────────────────────
  startVoice() {
    useAetherStore.getState().setVoiceActive(true);
    useAetherStore.getState().setVoiceState(VOICE_STATE.LISTENING);
    this.send('voice_start', {});
  }

  stopVoice() {
    useAetherStore.getState().setVoiceActive(false);
    useAetherStore.getState().setVoiceState(VOICE_STATE.IDLE);
    this.send('voice_stop', {});
  }

  bargeIn() {
    this.send('voice_barge_in', {});
  }

  // ─── Settings Commands ─────────────────────────────────────────────────────
  fetchModels() {
    this.send('models_list_request', {});
  }

  selectModel(modelName) {
    useAetherStore.getState().updateSettings({ selectedModel: modelName });
    this.send('model_select', { model: modelName });
  }
}

// Singleton instance
const wsClient = new AetherWSClient();
export default wsClient;