#!/usr/bin/env python3
"""
AETHER — Sovereign Local Intelligence System
Genesis Entry Point

This is the single command that brings your intelligence online.
"""

import os
import sys
import asyncio
import logging
import threading
from pathlib import Path

import yaml
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

# Internal imports
from config.config import load_config
from core.agent_graph import create_aether_graph
from ui.dashboard import launch_dashboard
from memory.long_term import LongTermMemory
from voice.interface import VoiceInterface
from tools.registry import ToolRegistry
from api.mobile_server import run_mobile_server

console = Console()

def print_banner():
    banner = Text()
    banner.append("A E T H E R", style="bold cyan")
    banner.append("\nSovereign Local Intelligence", style="dim white")
    banner.append("\nGenesis Build v0.1.0", style="dim cyan")
    console.print(Panel(banner, border_style="cyan", padding=(1, 4)))

def setup_logging(config: dict):
    log_level = config.get("system", {}).get("log_level", "INFO")
    logging.basicConfig(
        level=getattr(logging, log_level),
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("logs/aether.log", mode="a")
        ]
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("chromadb").setLevel(logging.WARNING)

async def initialize_system(config: dict):
    """Initialize all major subsystems in the correct order."""
    console.print("[cyan]Initializing Aether subsystems...[/cyan]")

    # 1. Long-term Memory (foundation)
    memory = LongTermMemory(config["memory"])
    await memory.initialize()
    console.print("  [green]✓[/green] Long-term Memory initialized")

    # 2. Tool Registry
    tools = ToolRegistry(config["tools"])
    console.print("  [green]✓[/green] Tool Registry initialized")

    # 3. Core Agent Graph
    graph = create_aether_graph(config["agent"], memory, tools, config)
    console.print("  [green]✓[/green] Agent Graph compiled")

    # 4. Voice Interface (optional)
    voice = None
    if config.get("voice", {}).get("enabled", True):
        voice = VoiceInterface(config["voice"])
        await voice.initialize()
        console.print("  [green]✓[/green] Voice Interface ready")

    console.print("[bold green]All subsystems online.[/bold green]\n")
    return {
        "config": config,
        "memory": memory,
        "tools": tools,
        "graph": graph,
        "voice": voice
    }

def start_mobile_server_in_background():
    """Start the FastAPI mobile WebSocket server in a background thread."""
    def run_server():
        try:
            run_mobile_server(host="0.0.0.0", port=8765)
        except Exception as e:
            console.print(f"[bold red]Mobile server failed to start:[/bold red] {e}")
    
    thread = threading.Thread(target=run_server, daemon=True)
    thread.start()
    console.print("[green]✓[/green] Mobile Companion API server started in background on port 8765")


async def main():
    print_banner()

    # Load configuration
    config_path = os.getenv("AETHER_CONFIG_PATH", "config/config.yaml")
    config = load_config(config_path)
    setup_logging(config)

    # Initialize everything
    try:
        system = await initialize_system(config)
    except Exception as e:
        console.print(f"[bold red]FATAL: Initialization failed[/bold red]\n{e}")
        sys.exit(1)

    # Start mobile API server in background (non-blocking)
    start_mobile_server_in_background()
    console.print("[cyan]Mobile Companion API ready at ws://<your-ip>:8765/ws[/cyan]\n")

    # Launch the Gradio dashboard (blocking)
    console.print("[cyan]Launching Gradio Mission Control dashboard...[/cyan]")
    console.print("Open http://localhost:7860 in your browser")
    console.print("Go to the 'Mobile Connection' tab to see the QR code and connection instructions.\n")

    launch_dashboard(system)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        console.print("\n[yellow]Aether shutting down gracefully...[/yellow]")
    except Exception as e:
        console.print(f"\n[bold red]Unexpected error:[/bold red] {e}")
        raise
