# Security Policy for AETHER

Aether is a **sovereign, local-first intelligence system**. Security is treated with extreme seriousness because users may eventually grant it powerful tools (code execution, file access, browser control, etc.).

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, email the maintainer directly at: **security@aether.local** (or open a private security advisory on GitHub if available).

Please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We take all reports seriously and will respond within 48 hours.

## Security Philosophy

### What Aether Does Well by Design

- **No cloud dependency for core cognition** — Your thoughts and memory never leave your machine unless you explicitly enable cloud tools.
- **Human-in-the-loop tool approval** — Every potentially dangerous action requires explicit user approval with clear reasoning shown.
- **Sandboxed tool execution** — Code execution and file operations are heavily restricted by default.
- **Full transparency** — Every reasoning step is visible in the dashboard.
- **Local WebSocket only** — Mobile companion connects only to your local network.

### Known Limitations (v0.2 Genesis)

- The current tool execution sandbox is basic. It is **not** a hardened jail. Do not give Aether access to sensitive systems until more robust sandboxing is implemented.
- Voice processing currently runs locally but processes raw audio. Be mindful if you run Aether in shared environments.
- The Gradio dashboard and WebSocket server have no built-in authentication in the current build. They are intended for local/trusted network use only.

## Recommendations for Production / High-Trust Use

1. Run Aether in an isolated environment or container with limited host access.
2. Review every tool before approving it.
3. Use the importance scoring and reflection system to let Aether learn safe boundaries over time.
4. Consider putting the mobile companion behind a reverse proxy with TLS + authentication if exposing beyond your local network (advanced users only).

## Responsible Disclosure

We appreciate responsible disclosure. Contributors who report valid security issues will be publicly acknowledged (unless they prefer anonymity).

Thank you for helping keep Aether secure and sovereign.
