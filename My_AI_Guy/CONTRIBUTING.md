# Contributing to AETHER

Thank you for your interest in contributing to Aether — the sovereign local intelligence system.

Aether is built with a very specific philosophy: **maximum autonomy, radical transparency, local supremacy, and zero cloud dependency for core cognition**. Every contribution must honor this.

## Core Principles

Before contributing, please internalize these non-negotiable principles:

- **Local-first always.** New features must work completely offline by default.
- **Transparency over magic.** Every decision, tool call, and reflection must be inspectable and interruptible.
- **Human sovereignty.** The user must remain in ultimate control. No hidden cloud calls, no forced telemetry, no "phone home" behavior.
- **Self-improvement.** Contributions that help Aether get smarter over time are highly valued.
- **Simplicity with power.** We prefer clean, understandable code over clever abstractions.

## How to Contribute

### 1. Reporting Issues

- Use the issue templates provided in `.github/ISSUE_TEMPLATE/`.
- Be extremely specific. Include:
  - Exact steps to reproduce
  - Expected vs actual behavior
  - Your environment (OS, Python version, Ollama model, hardware)
  - Relevant logs from the dashboard or terminal

### 2. Suggesting Features

We are very selective about new features. A feature request should answer:

- Does this increase user sovereignty and control?
- Does it work fully locally?
- Does it make Aether more transparent or self-improving?
- Can it be implemented without compromising the core architecture?

### 3. Code Contributions

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following the existing code style and architecture
4. Test thoroughly (especially tool execution, memory, and the agent graph)
5. Submit a Pull Request using the PR template

### Code Style Guidelines

- Use type hints everywhere
- Write clear docstrings (Google or NumPy style)
- Keep functions focused and small
- Prefer explicit over implicit
- No hidden side effects in core reasoning paths
- All new tools must go through the approval workflow in `tools/registry.py`

### Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests
- `chore:` Maintenance tasks

Example: `feat(memory): add importance decay for old episodic memories`

## Development Setup

```bash
git clone https://github.com/yourusername/aether.git
cd aether
./install.sh
```

For development, you may want to run components individually:

```bash
python -m uvicorn api.mobile_server:app --reload --port 8765
python main.py
```

## Questions?

Open a discussion or reach out via issues. We move deliberately.

---

**Aether exists to give individuals god-tier local intelligence. Every contribution should serve that mission.**
