#!/bin/bash
# Roo Blessed Client Environment Setup

export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"

echo "🔧 Environment configured:"
echo "   ROO_CODE_IPC_SOCKET_PATH=/tmp/roo-code-ipc.sock"
echo ""
echo "💡 Now restart your code-server with this environment variable set"
echo "   or run: source ./setup-env.sh && code-server"
echo ""
echo "🧪 Test connection: npm test"
echo "🚀 Start client: npm start"
