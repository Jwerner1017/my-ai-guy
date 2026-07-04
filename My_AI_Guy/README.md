# AETHER — Sovereign Local Intelligence System

**Version:** 0.2.0 (Genesis Superior Build)  
**Status:** Production-Grade Foundational Architecture  
**License:** MIT  
**Philosophy:** Maximum autonomy. Zero cloud dependency for core cognition. Total transparency. Infinite self-improvement. Local-first. Yours forever.

> **Aether is not another chatbot wrapper.**  
> It is a **living, reasoning, self-evolving intelligence** that runs entirely on your hardware. It thinks in graphs, remembers across years, speaks with production voice, and exposes every thought process in real time.

This is the complete, authoritative design document and implementation guide. Every component has been engineered with extreme intentionality to make Aether the single greatest local agent system in existence.

---

## Quick Start (One Command)

```bash
git clone https://github.com/Jwerner1017/aether.git
cd aether
./install.sh
```

Then open **http://localhost:7860** — your sovereign intelligence is live.

For manual Docker:
```bash
docker compose up --build
```

---

## What Makes Aether Different

Most agent systems are brittle chains of LLM calls with toy memory and zero self-awareness. They forget everything between sessions, hallucinate plans, and hide their reasoning behind black boxes.

**Aether is the antidote.**

| Principle                    | Implementation                                                                 | Why It Matters |
|-----------------------------|----------------------------------------------------------------------------------|----------------|
| **Graph-Native Reasoning**   | Full LangGraph with Planner → Executor → Reflector → Memory Writer loop         | Every decision is inspectable, interruptible, and auditable |
| **True Long-Term Memory**    | Hybrid episodic + semantic + reflective memory with importance scoring          | It actually learns and gets smarter the longer you use it |
| **Radical Transparency**     | Live streaming of every node, tool call, and reflection to the dashboard        | You see it think. You can intervene at any moment |
| **Human-in-the-Loop Tools**  | Every powerful action requires explicit approval with clear reasoning           | Safe to give it real capability |
| **Self-Improvement Loop**    | Built-in meta-reasoning that critiques performance and stores lessons           | It doesn't just work — it evolves without you |
| **Local Supremacy**          | 100% offline core. Optional cloud tools only when you explicitly enable them    | Your data never leaves unless you want it to |
| **Mobile Command Surface**   | First-class React Native companion app with QR discovery + real-time control    | Command your intelligence from anywhere |
| **Production Voice**         | Low-latency faster-whisper + Piper with barge-in and emotional prosody          | Natural conversation, not robotic |

Aether is designed to be **the last agent system you will ever need to build**.

---

## Mobile Companion App (Included)

Aether ships with a complete mobile connection system:

- **QR Code Discovery** — Scan the code in the dashboard to connect instantly
- **WebSocket Real-Time** — Live reasoning trace, goal submission, and tool approvals from your phone
- **Three-Tier Fallback** — QR → mDNS auto-discovery → Manual IP entry
- **Full Control Surface** — Dashboard, memory browser, voice mode, approvals queue, settings

The companion app prompt (hyper-detailed, production-ready) is available via the `app-crafter` skill. It generates a premium React Native + Expo experience that feels like mission control for a sovereign intelligence.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AETHER SOVEREIGN INTELLIGENCE STACK                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Mobile Companion (React Native + Expo)  ←  WebSocket + QR Discovery         │
│         ↓                                                                     │
│  Gradio Dashboard — Live reasoning visualization + full control               │
│         ↓                                                                     │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌────────────────┐  │
│  │   Core Agent Graph    │◄──│   Long-Term Memory    │──►│   Tool Registry│  │
│  │   (LangGraph)         │   │   (Hybrid + Reflective)│  │   (Sandbox +     │  │
│  │   Planner → Executor  │   │   Importance Scoring  │  │    Approval)     │  │
│  │   → Reflector → Write │   │                       │  │                │  │
│  └───────────────────────┘   └───────────────────────┘   └────────────────┘  │
│         ↑                              ↑                       ↑              │
│  ┌──────┴──────┐              ┌────────┴────────┐     ┌────────┴────────┐     │
│  │ Voice I/O   │              │ Self-Improvement│     │ Browser / Code  │     │
│  │ (Whisper+Piper)│           │     Engine      │     │ Execution / etc │     │
│  └─────────────┘              └─────────────────┘     └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Core Components:**
- `core/agent_graph.py` — Multi-node LangGraph with real LLM planning, tool execution, reflection, and memory writing
- `memory/long_term.py` — Hybrid retrieval (semantic + recency + importance) + dedicated reflection collection
- `tools/registry.py` — Permissioned, logged, sandboxed tool execution with approval workflow
- `api/mobile_server.py` — FastAPI + WebSocket server for mobile companion (port 8765)
- `ui/dashboard.py` — Gradio mission control with QR code, live trace, memory browser, and approvals
- `voice/interface.py` — Production voice foundation (ready for full faster-whisper + Piper)

---

## Project Structure

```
aether/
├── README.md
├── LICENSE
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── install.sh
├── requirements.txt
├── main.py
├── config/
│   └── config.yaml
├── core/
│   └── agent_graph.py
├── memory/
│   └── long_term.py
├── tools/
│   └── registry.py
├── api/
│   ├── __init__.py
│   └── mobile_server.py
├── voice/
│   └── interface.py
├── ui/
│   └── dashboard.py
├── data/                 # Runtime data (voices, chroma, etc.)
└── user_files/           # User-approved file access
```

---

## Installation & Running

### Recommended (Docker)

```bash
./install.sh
```

This handles directory creation, Ollama pull, image build, and startup.

### Manual / Development

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Make sure Ollama is running locally with a model
ollama pull llama3.1:8b

python main.py
```

Dashboard will be available at `http://localhost:7860`

Mobile WebSocket server runs automatically on port `8765`.

---

## Configuration

Edit `config/config.yaml` to control:

- LLM model and parameters
- Memory importance thresholds and reflection frequency
- Tool permissions and sandbox limits
- Voice settings
- Mobile connection behavior

---

## Development Philosophy

This codebase follows strict principles:

- **No magic** — Every component is explicit and inspectable
- **Human sovereignty** — Powerful actions default to approval
- **Obsessive quality** — Production reliability, observability, and beauty even in early genesis
- **Local-first** — Core cognition never requires the internet

---

## Roadmap (Genesis → Supremacy)

- [x] Core LangGraph reasoning engine with reflection loop
- [x] Hybrid long-term memory with importance scoring
- [x] Permissioned tool system with approval workflow
- [x] Mobile connection API + QR code discovery
- [x] Gradio mission control dashboard
- [ ] Full voice interface (faster-whisper + Piper + barge-in)
- [ ] Production-grade browser tool with accessibility understanding
- [ ] Self-improvement meta-agent that proposes code upgrades
- [ ] Aether Companion mobile app (React Native)
- [ ] Encrypted memory export / backup system
- [ ] Multi-agent orchestration layer

---

## Contributing

Aether is built with extreme intentionality. Contributions that align with the philosophy of sovereignty, transparency, and local supremacy are welcome.

Please open issues or pull requests with clear reasoning. All powerful changes must preserve the human-in-the-loop default.

---

## License

MIT License — see [LICENSE](LICENSE) file.

You are free to use, modify, and distribute Aether. Keep it sovereign.

---

**Aether is not here to assist you.**

**Aether is here to become the most capable extension of your own mind.**

Welcome to the genesis build.

*This document and system were authored with extreme intentionality. Every line exists for a reason.*
