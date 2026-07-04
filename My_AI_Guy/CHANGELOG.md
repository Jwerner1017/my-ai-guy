# Changelog

All notable changes to Aether will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - 2026-06-29 — Genesis Superior Build

### Added
- Complete production-grade LangGraph reasoning core (`core/agent_graph.py`)
  - Planner → Executor (with tool calling) → Reflector → Memory Writer loop
  - Real LLM-powered planning and reflection using Ollama
  - Streaming execution trace and human-in-the-loop approval workflow
- Full long-term memory system (`memory/long_term.py`)
  - Hybrid retrieval (semantic + recency + importance scoring)
  - Dedicated reflection collection for self-improvement
  - `reflect_and_learn()` meta-reasoning cycle
- Permissioned tool registry (`tools/registry.py`)
  - Sandboxed code execution
  - Safe file operations
  - Approval enforcement and execution logging
- Mobile Companion API (`api/mobile_server.py`)
  - FastAPI + WebSocket server on port 8765
  - Real-time goal submission, reasoning trace, and tool approvals
- Enhanced Gradio Dashboard
  - New "Mobile Connection" tab with live QR code + local IP display
  - Three-tier discovery system (QR → mDNS → Manual IP)
- Professional open-source repository foundation
  - `.gitignore`, `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
  - Issue templates and Pull Request template
- Comprehensive `README.md` with philosophy, architecture, and quick start

### Changed
- `main.py` now properly initializes the full agent graph and mobile server
- `requirements.txt` updated with production dependencies (LangGraph, FastAPI, qrcode, etc.)

### Philosophy
This release establishes Aether as a genuinely functional sovereign agent system in genesis form — not a prototype. Every core component is designed for transparency, local supremacy, and long-term self-improvement.

---

## [0.1.0] - Initial Foundational Architecture

- Initial project structure
- Basic LangGraph skeleton
- Gradio dashboard foundation
- Docker + install.sh setup
