#!/bin/bash

# Default to not generating systemd file
GENERATE_SYSTEMD=false

# Check for --systemd flag
if [ "$1" == "--systemd" ]; then
    GENERATE_SYSTEMD=true
fi

# Default to not generating systemd file
GENERATE_SYSTEMD=false

# Check for --systemd flag
if [ "$1" == "--systemd" ]; then
    GENERATE_SYSTEMD=true
fi

# Roo Code Server Launcher with IPC Socket
# This script launches code-server with the necessary environment variables for Roo IPC

set -e

# Configuration
SOCKET_PATH="/tmp/roo-code-ipc.sock"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-8081}"
CODE_SERVER_HOST="${CODE_SERVER_HOST:-0.0.0.0}"
CODE_SERVER_AUTH="${CODE_SERVER_AUTH:-password}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Roo Code Server Launcher${NC}"
echo "================================"

# Clean up any existing socket
if [ -S "$SOCKET_PATH" ]; then
    echo -e "${YELLOW}⚠️  Cleaning up existing socket: $SOCKET_PATH${NC}"
    rm -f "$SOCKET_PATH"
fi

# Set environment variables
export ROO_CODE_IPC_SOCKET_PATH="$SOCKET_PATH"

echo -e "${GREEN}🔧 Configuration:${NC}"
echo "   Socket Path: $SOCKET_PATH"
echo "   Server Host: $CODE_SERVER_HOST"
echo "   Server Port: $CODE_SERVER_PORT"
echo "   Auth Method: $CODE_SERVER_AUTH"
echo ""

# Check if code-server is installed and find the correct path
CODE_SERVER_PATH=""

# Try different possible paths in order of preference
for path in "/usr/bin/code-server" "/usr/lib/code-server/bin/code-server"; do
    if [ -x "$path" ]; then
        CODE_SERVER_PATH="$path"
        break
    fi
done

# Fallback to which command if direct paths don't work
if [ -z "$CODE_SERVER_PATH" ]; then
    WHICH_PATH="$(which code-server 2>/dev/null)"
    if [ -n "$WHICH_PATH" ] && [ -x "$WHICH_PATH" ] && [ "$WHICH_PATH" != "/usr/lib/code-server/lib/vscode/bin/remote-cli/code-server" ]; then
        CODE_SERVER_PATH="$WHICH_PATH"
    fi
fi

if [ -z "$CODE_SERVER_PATH" ]; then
    echo -e "${RED}❌ code-server not found${NC}"
    echo "Install code-server first:"
    echo "  curl -fsSL https://code-server.dev/install.sh | sh"
    echo ""
    echo "Searched paths:"
    echo "  /usr/bin/code-server - $([ -x /usr/bin/code-server ] && echo "exists" || echo "not found")"
    echo "  /usr/lib/code-server/bin/code-server - $([ -x /usr/lib/code-server/bin/code-server ] && echo "exists" || echo "not found")"
    exit 1
fi

echo -e "${GREEN}✅ code-server found at: $CODE_SERVER_PATH${NC}"

# Create a systemd service file if requested
if [ "$1" = "--create-service" ]; then
    SERVICE_FILE="/etc/systemd/system/roo-code-server.service"
    echo -e "${BLUE}📝 Creating systemd service...${NC}"
    
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Roo Code Server with IPC
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
Environment=ROO_CODE_IPC_SOCKET_PATH=$SOCKET_PATH
ExecStart=$CODE_SERVER_PATH --bind-addr $CODE_SERVER_HOST:$CODE_SERVER_PORT --auth $CODE_SERVER_AUTH
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo -e "${GREEN}✅ Service created: $SERVICE_FILE${NC}"
    echo "To enable and start:"
    echo "  sudo systemctl enable roo-code-server"
    echo "  sudo systemctl start roo-code-server"
    echo "  sudo systemctl status roo-code-server"
    exit 0
fi

# Create a Docker Compose file if requested
if [ "$1" = "--create-docker" ]; then
    echo -e "${BLUE}📝 Creating Docker Compose configuration...${NC}"
    
    cat > docker-compose.yml <<EOF
version: '3.8'

services:
  roo-code-server:
    image: codercom/code-server:latest
    container_name: roo-code-server
    ports:
      - "$CODE_SERVER_PORT:8080"
    volumes:
      - ./workspace:/home/coder/workspace
      - /tmp:/tmp
    environment:
      - ROO_CODE_IPC_SOCKET_PATH=$SOCKET_PATH
      - PASSWORD=\${CODE_SERVER_PASSWORD:-password}
    command: >
      code-server
      --bind-addr 0.0.0.0:8080
      --auth password
      /home/coder/workspace
    restart: unless-stopped
EOF

    echo -e "${GREEN}✅ Docker Compose created: docker-compose.yml${NC}"
    echo "To start:"
    echo "  docker-compose up -d"
    echo "  docker-compose logs -f"
    exit 0
fi

# Function to handle cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    if [ -S "$SOCKET_PATH" ]; then
        rm -f "$SOCKET_PATH"
        echo -e "${GREEN}✅ Socket cleaned up${NC}"
    fi
}

# Set up signal handlers
trap cleanup EXIT INT TERM

if [ "$GENERATE_SYSTEMD" = true ]; then
    # Generate systemd service file
    SERVICE_FILE_PATH="$HOME/.config/systemd/user/roo-code-server.service"
    mkdir -p "$(dirname "$SERVICE_FILE_PATH")"

    echo "✅ Generating systemd service file at: $SERVICE_FILE_PATH"

    cat > "$SERVICE_FILE_PATH" <<EOL
[Unit]
Description=Roo Code Server

[Service]
ExecStart=$CODE_SERVER_PATH --bind-addr $CODE_SERVER_HOST:$CODE_SERVER_PORT --auth $CODE_SERVER_AUTH
Environment="ROO_CODE_IPC_SOCKET_PATH=$SOCKET_PATH"
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOL

    echo "✅ Service file created."
    echo "💡 To use it, run:"
    echo "   systemctl --user daemon-reload"
    echo "   systemctl --user start roo-code-server.service"
    echo "   systemctl --user enable roo-code-server.service"
else
    # Launch code-server directly
    echo "🚀 Starting code-server..."
    echo "   Access at: http://$CODE_SERVER_HOST:$CODE_SERVER_PORT"
    echo "   Socket will be created at: $SOCKET_PATH"
    echo ""
    echo "💡 In another terminal, run:"
    echo "   cd roo-blessed && npm test"
    echo "   cd roo-blessed && npm start"
    echo ""
    echo "Press Ctrl+C to stop"

    ROO_CODE_IPC_SOCKET_PATH="$SOCKET_PATH" \
    exec "$CODE_SERVER_PATH" \
        --host "$CODE_SERVER_HOST" \
        --port "$CODE_SERVER_PORT" \
        --auth "$CODE_SERVER_AUTH" \
        .
fi