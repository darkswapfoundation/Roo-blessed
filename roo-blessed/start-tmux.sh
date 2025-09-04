#!/bin/bash

# Roo Tmux Session Starter
# Creates a tmux session with daemon and CLI in separate panes

set -e

# Configuration
SESSION_NAME="roo"
DAEMON_PORT="${DAEMON_PORT:-7777}"
DAEMON_HOST="${DAEMON_HOST:-localhost}"
SOCKET_PATH="${ROO_CODE_IPC_SOCKET_PATH:-/tmp/roo-code-ipc.sock}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Roo Tmux Session${NC}"
echo "================================"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}❌ tmux is not installed${NC}"
    echo "Install tmux first:"
    echo "  Ubuntu/Debian: sudo apt install tmux"
    echo "  macOS: brew install tmux"
    echo "  CentOS/RHEL: sudo yum install tmux"
    exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Session '$SESSION_NAME' already exists${NC}"
    echo "Options:"
    echo "  1. Attach to existing session: tmux attach -t $SESSION_NAME"
    echo "  2. Kill existing session: tmux kill-session -t $SESSION_NAME"
    echo "  3. Use different session name: SESSION_NAME=roo2 $0"
    exit 1
fi

# Check environment
echo -e "${CYAN}🔧 Configuration:${NC}"
echo "   Session Name: $SESSION_NAME"
echo "   Daemon Port: $DAEMON_PORT"
echo "   Daemon Host: $DAEMON_HOST"
echo "   IPC Socket: $SOCKET_PATH"
echo ""

# Verify IPC socket path is set
if [ -z "$ROO_CODE_IPC_SOCKET_PATH" ]; then
    echo -e "${YELLOW}⚠️  ROO_CODE_IPC_SOCKET_PATH not set${NC}"
    echo "Setting default: $SOCKET_PATH"
    export ROO_CODE_IPC_SOCKET_PATH="$SOCKET_PATH"
fi

# Check if socket exists
if [ ! -S "$SOCKET_PATH" ]; then
    echo -e "${YELLOW}⚠️  IPC socket does not exist: $SOCKET_PATH${NC}"
    echo "Make sure Roo Code extension is running with IPC enabled."
    echo "The daemon will wait for the socket to be created."
fi

# Create tmux session
echo -e "${GREEN}📺 Creating tmux session '$SESSION_NAME'...${NC}"

# Create session with first window for daemon
tmux new-session -d -s "$SESSION_NAME" -n "daemon"

# Set up daemon pane
tmux send-keys -t "$SESSION_NAME:daemon" "cd $(pwd)" Enter
tmux send-keys -t "$SESSION_NAME:daemon" "echo '🔧 Starting Roo Daemon...'" Enter
tmux send-keys -t "$SESSION_NAME:daemon" "node roo-daemon.js --port $DAEMON_PORT --host $DAEMON_HOST" Enter

# Split window horizontally for CLI
tmux split-window -h -t "$SESSION_NAME:daemon"

# Set up CLI pane (wait a moment for daemon to start)
tmux send-keys -t "$SESSION_NAME:daemon.1" "cd $(pwd)" Enter
tmux send-keys -t "$SESSION_NAME:daemon.1" "echo '⏳ Waiting for daemon to start...'" Enter
tmux send-keys -t "$SESSION_NAME:daemon.1" "sleep 3" Enter
tmux send-keys -t "$SESSION_NAME:daemon.1" "echo '🖥️  Starting Roo CLI...'" Enter
tmux send-keys -t "$SESSION_NAME:daemon.1" "node roo-cli.js --port $DAEMON_PORT --host $DAEMON_HOST" Enter

# Create a second window for monitoring/logs
tmux new-window -t "$SESSION_NAME" -n "monitor"
tmux send-keys -t "$SESSION_NAME:monitor" "cd $(pwd)" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo '📊 Monitoring Window'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Use this window for:'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  - Checking logs: tail -f /tmp/roo*.log'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  - Testing connection: npm test'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo '  - Running other commands'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo ''" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Switch between windows: Ctrl+b then 1 or 2'" Enter
tmux send-keys -t "$SESSION_NAME:monitor" "echo 'Switch between panes: Ctrl+b then arrow keys'" Enter

# Set the CLI pane as the active one
tmux select-window -t "$SESSION_NAME:daemon"
tmux select-pane -t "$SESSION_NAME:daemon.1"

echo -e "${GREEN}✅ Tmux session created successfully!${NC}"
echo ""
echo -e "${CYAN}📋 Session Layout:${NC}"
echo "   Window 1 (daemon): Daemon (left) | CLI (right)"
echo "   Window 2 (monitor): Monitoring and logs"
echo ""
echo -e "${CYAN}🎮 Tmux Controls:${NC}"
echo "   Switch windows: Ctrl+b then 1 or 2"
echo "   Switch panes: Ctrl+b then arrow keys"
echo "   Detach session: Ctrl+b then d"
echo "   Kill session: Ctrl+b then :kill-session"
echo ""
echo -e "${CYAN}🔗 Attach to session:${NC}"
echo "   tmux attach -t $SESSION_NAME"
echo ""

# Attach to the session
echo -e "${GREEN}🎯 Attaching to session...${NC}"
sleep 1
tmux attach -t "$SESSION_NAME"