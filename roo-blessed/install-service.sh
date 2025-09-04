#!/bin/bash

# Install Roo Code Server as a system service
# This script creates a systemd service for automatic startup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Roo Code Server Service Installer${NC}"
echo "====================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Don't run this script as root${NC}"
    echo "Run as your regular user - it will use sudo when needed"
    exit 1
fi

# Configuration
USER_NAME="$USER"
HOME_DIR="$HOME"
SOCKET_PATH="/tmp/roo-code-ipc.sock"
SERVICE_NAME="roo-code-server"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-8080}"
CODE_SERVER_HOST="${CODE_SERVER_HOST:-0.0.0.0}"

echo -e "${GREEN}📋 Configuration:${NC}"
echo "   User: $USER_NAME"
echo "   Home: $HOME_DIR"
echo "   Socket: $SOCKET_PATH"
echo "   Service: $SERVICE_NAME"
echo "   Port: $CODE_SERVER_PORT"
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

# Create the service file
echo -e "${BLUE}📝 Creating systemd service...${NC}"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Roo Code Server with IPC Socket
Documentation=https://github.com/coder/code-server
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER_NAME
Group=$USER_NAME
WorkingDirectory=$HOME_DIR
Environment=ROO_CODE_IPC_SOCKET_PATH=$SOCKET_PATH
Environment=HOME=$HOME_DIR
Environment=USER=$USER_NAME
ExecStart=$CODE_SERVER_PATH --bind-addr $CODE_SERVER_HOST:$CODE_SERVER_PORT --auth password
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=roo-code-server

# Security settings
NoNewPrivileges=true
PrivateTmp=false
ProtectSystem=strict
ProtectHome=false
ReadWritePaths=$HOME_DIR /tmp
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✅ Service file created: $SERVICE_FILE${NC}"

# Reload systemd
echo -e "${BLUE}🔄 Reloading systemd...${NC}"
sudo systemctl daemon-reload

# Enable the service
echo -e "${BLUE}🔧 Enabling service...${NC}"
sudo systemctl enable "$SERVICE_NAME"

echo -e "${GREEN}✅ Service installed and enabled!${NC}"
echo ""
echo -e "${YELLOW}📋 Service Management Commands:${NC}"
echo "   Start:   sudo systemctl start $SERVICE_NAME"
echo "   Stop:    sudo systemctl stop $SERVICE_NAME"
echo "   Restart: sudo systemctl restart $SERVICE_NAME"
echo "   Status:  sudo systemctl status $SERVICE_NAME"
echo "   Logs:    sudo journalctl -u $SERVICE_NAME -f"
echo ""

# Ask if user wants to start now
read -p "Start the service now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🚀 Starting service...${NC}"
    sudo systemctl start "$SERVICE_NAME"
    
    # Wait a moment for startup
    sleep 3
    
    # Check status
    if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
        echo -e "${GREEN}✅ Service started successfully!${NC}"
        echo "   Access at: http://$CODE_SERVER_HOST:$CODE_SERVER_PORT"
        echo "   Socket at: $SOCKET_PATH"
        echo ""
        echo -e "${YELLOW}💡 Test the connection:${NC}"
        echo "   cd roo-blessed && npm test"
        echo "   cd roo-blessed && npm start"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        echo "Check logs: sudo journalctl -u $SERVICE_NAME -n 20"
    fi
else
    echo -e "${YELLOW}💡 Start manually when ready:${NC}"
    echo "   sudo systemctl start $SERVICE_NAME"
fi

echo ""
echo -e "${GREEN}🎉 Installation complete!${NC}"