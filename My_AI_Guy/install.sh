#!/bin/bash
# AETHER One-Command Installation Script
# Run this after cloning the repository

set -e

echo "=========================================="
echo "   AETHER — Sovereign Local Intelligence"
echo "   Genesis Installation"
echo "=========================================="

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Docker is required but not installed."
    echo "Please install Docker Desktop or Docker Engine first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "Docker Compose is required but not installed."
    exit 1
fi

echo "[1/5] Creating data directories..."
mkdir -p data user_files logs

echo "[2/5] Pulling Ollama image (this may take a while)..."
docker pull ollama/ollama:latest

echo "[3/5] Building Aether image..."
docker compose build --no-cache

echo "[4/5] Starting services..."
docker compose up -d

echo "[5/5] Waiting for services to initialize..."
sleep 8

echo ""
echo "=========================================="
echo "   AETHER is now running!"
echo "=========================================="
echo ""
echo "Dashboard: http://localhost:7860"
echo ""
echo "Next steps:"
echo "  1. Make sure you have Ollama running locally with a model:"
echo "     ollama pull llama3.1:8b"
echo "  2. Open the dashboard and start interacting"
echo "  3. For voice: download a Piper voice model into ./data/voices/"
echo ""
echo "To stop: docker compose down"
echo "To view logs: docker compose logs -f aether"
echo ""
echo "Welcome to your sovereign intelligence."
echo "=========================================="
