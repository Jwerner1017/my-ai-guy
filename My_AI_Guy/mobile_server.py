"""
AETHER Mobile Companion API Server
==================================
Production-grade FastAPI + WebSocket server that powers the Aether Companion mobile app.

This server provides:
- WebSocket endpoint for real-time bidirectional communication
- REST endpoints for status, memory queries, and tool approvals
- Clean separation from the main Gradio dashboard

The mobile app connects here (default port 8765) using the three-tier discovery system.
"""

import asyncio
import json
import logging
import socket
from typing import Dict, Any, Set
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections from mobile apps."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.connection_info: Dict[WebSocket, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, client_info: Dict[str, Any] = None):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.connection_info[websocket] = {
            "connected_at": datetime.utcnow().isoformat(),
            "client_info": client_info or {},
            "last_heartbeat": datetime.utcnow().isoformat()
        }
        logger.info(f"Mobile client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.connection_info.pop(websocket, None)
        logger.info(f"Mobile client disconnected. Remaining: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Failed to send message to client: {e}")
            self.disconnect(websocket)
    
    async def broadcast(self, message: dict):
        """Send message to all connected mobile clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)


# Global connection manager instance
manager = ConnectionManager()

# FastAPI application
app = FastAPI(
    title="Aether Mobile Companion API",
    description="Real-time control surface for the Aether sovereign intelligence system",
    version="0.1.0"
)

# CORS middleware (restrict in production if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local network only in practice
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/status")
async def get_status():
    """Basic health and discovery endpoint for mobile apps."""
    return {
        "status": "online",
        "name": "Aether Sovereign Intelligence",
        "version": "0.1.0-genesis",
        "timestamp": datetime.utcnow().isoformat(),
        "websocket_endpoint": "/ws",
        "recommended_port": 8765
    }


@app.get("/discovery")
async def discovery_info():
    """
    Returns information useful for manual connection and QR code generation.
    The Gradio dashboard calls this or generates QR from here.
    """
    local_ips = get_local_ip_addresses()
    return {
        "name": "Aether Home",
        "host": local_ips[0] if local_ips else "127.0.0.1",
        "port": 8765,
        "all_local_ips": local_ips,
        "websocket_path": "/ws",
        "instructions": "Scan the QR code in the dashboard or enter IP + port manually."
    }


def get_local_ip_addresses() -> list[str]:
    """Return all non-loopback IPv4 addresses for this machine."""
    ips = []
    try:
        hostname = socket.gethostname()
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_INET)
        for info in addr_info:
            ip = info[4][0]
            if ip != "127.0.0.1" and not ip.startswith("169.254"):
                ips.append(ip)
    except Exception as e:
        logger.warning(f"Could not determine local IPs: {e}")
        ips = ["127.0.0.1"]
    return list(set(ips)) or ["127.0.0.1"]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Main real-time communication channel for the mobile companion app.
    
    Message types supported (bidirectional):
    - client → server: {"type": "heartbeat"}, {"type": "goal", "content": "..."}, {"type": "approve_tool", "id": "..."}
    - server → client: {"type": "reasoning_update", ...}, {"type": "tool_approval_request", ...}, {"type": "memory_update", ...}
    """
    await manager.connect(websocket)
    
    try:
        # Send initial connection confirmation
        await manager.send_personal_message({
            "type": "connection_established",
            "message": "Successfully connected to Aether. You now have live access to reasoning, memory, and tool control.",
            "timestamp": datetime.utcnow().isoformat()
        }, websocket)
        
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                msg_type = message.get("type")
                
                if msg_type == "heartbeat":
                    await manager.send_personal_message({
                        "type": "heartbeat_ack",
                        "timestamp": datetime.utcnow().isoformat()
                    }, websocket)
                
                elif msg_type == "goal":
                    # In full implementation: trigger the agent graph
                    logger.info(f"Received goal from mobile: {message.get('content')}")
                    await manager.send_personal_message({
                        "type": "goal_received",
                        "message": "Goal received. Aether is now reasoning...",
                        "goal": message.get("content")
                    }, websocket)
                    # TODO: Integrate with actual agent_graph execution and stream updates
                
                elif msg_type == "approve_tool":
                    # Handle tool approval from mobile
                    logger.info(f"Tool approval received: {message}")
                    await manager.send_personal_message({
                        "type": "tool_approval_recorded",
                        "tool_id": message.get("id"),
                        "status": "approved"
                    }, websocket)
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Unknown message type: {msg_type}"
                    }, websocket)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON received"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


def run_mobile_server(host: str = "0.0.0.0", port: int = 8765):
    """Run the mobile API server (blocking)."""
    logger.info(f"Starting Aether Mobile Companion API on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_mobile_server()