"""
AETHER Configuration Loader
Handles YAML loading with validation and environment variable overrides.
"""

from pathlib import Path
from typing import Any, Dict
import yaml
import os

def load_config(config_path: str = "config/config.yaml") -> Dict[str, Any]:
    """Load and validate Aether configuration."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with open(path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    # Apply environment variable overrides (simple implementation)
    if os.getenv("AETHER_LLM_MODEL"):
        config.setdefault("llm", {})["model"] = os.getenv("AETHER_LLM_MODEL")

    # Ensure critical directories exist
    data_dir = Path(config.get("system", {}).get("data_dir", "./data"))
    data_dir.mkdir(parents=True, exist_ok=True)

    return config
