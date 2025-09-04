# Roo Daemon/CLI Troubleshooting Guide

## Connection States & Status Indicators

### CLI Status Indicators
- 🔴 `roo>` - **Disconnected from daemon**
  - Daemon is not running or not reachable
  - Solution: Start daemon with `npm run daemon`

- 🟡 `roo>` - **Connected to daemon, Roo not ready**
  - Daemon is running but not connected to Roo IPC
  - Solution: Check Roo Code extension and IPC socket

- 🟢 `roo>` - **Ready to send tasks**
  - Daemon connected to Roo and ready to accept commands

- 🔵 `roo>` - **Task in progress**
  - A task is currently being processed by Roo

## Common Issues & Solutions

### 1. "Connection not fully established"

**Symptoms:**
```
🟢 roo> test
📝 Sending: "test"
❌ Connection not fully established
```

**Daemon logs show:**
```
[ERROR] Cannot send task: no client ID
```

**Cause:** Daemon is not connected to Roo IPC socket

**Solutions:**

#### Check IPC Socket
```bash
# Check if socket exists
ls -la /tmp/roo-code-ipc.sock

# If not found, check environment
echo $ROO_CODE_IPC_SOCKET_PATH
```

#### Restart Code-Server with IPC
```bash
# Set environment and restart code-server
export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"
code-server --bind-addr 0.0.0.0:8080
```

#### Check Roo Extension
1. Open VSCode/code-server
2. Check that Roo Code extension is installed and enabled
3. Look for IPC-related messages in extension output panel

### 2. "Unknown IPC message type" warnings

**Symptoms:**
```
[WARN] Unknown IPC message type: TaskEvent
[WARN] Unknown IPC message type: Ack
```

**Cause:** Message type case sensitivity issues

**Solution:** This is now fixed in the latest version. Update your files if you see this.

### 3. Port already in use

**Symptoms:**
```
[ERROR] TCP server error: listen EADDRINUSE: address already in use 127.0.0.1:7777
```

**Solutions:**

#### Kill existing daemon
```bash
pkill -f "roo-daemon"
```

#### Use different port
```bash
node roo-daemon.js --port 7778
node roo-cli.js --port 7778
```

#### Find what's using the port
```bash
netstat -tulpn | grep 7777
lsof -i :7777
```

### 4. CLI shows wrong status

**Symptoms:**
- CLI shows 🟢 but tasks fail
- Status doesn't match actual connection state

**Solution:**
1. Use `/status` command in CLI to check detailed status
2. Check daemon logs for actual connection state
3. Restart both daemon and CLI

### 5. Tmux session issues

**Symptoms:**
- Session won't start
- Panes don't show expected content

**Solutions:**

#### Check tmux version
```bash
tmux -V  # Should be 2.0+
```

#### Kill existing session
```bash
tmux kill-session -t roo
```

#### Manual session creation
```bash
# Start daemon manually
npm run daemon

# In another terminal, start CLI
npm run cli
```

## Debugging Steps

### 1. Test Components Individually

```bash
# Test IPC connection
npm test

# Test daemon/CLI communication
npm run test-daemon

# Test UI without IPC
npm run test-ui
```

### 2. Check Logs

#### Daemon Logs
- Look for connection status messages
- Check for IPC message types
- Verify client ID assignment

#### CLI Logs
- Check connection status
- Verify welcome messages
- Look for error messages

### 3. Verify Environment

```bash
# Check environment variables
env | grep ROO

# Check socket permissions
ls -la /tmp/roo-code-ipc.sock

# Check process status
ps aux | grep roo
```

## Status Messages Explained

### Daemon Messages
- `✅ Connected to Roo Code IPC server` - IPC connection established
- `✅ Received client ID: xxx` - Ready to send tasks
- `📨 Received IPC message: TaskEvent` - Processing Roo events
- `❌ IPC socket does not exist` - Need to start code-server with IPC

### CLI Messages
- `✅ Connected to Roo Daemon` - TCP connection to daemon OK
- `🎉 Roo is ready! Client ID: xxx` - Full connection established
- `🔄 Connected to daemon, waiting for Roo connection...` - Daemon not connected to Roo
- `⚠️ Daemon not connected to Roo` - IPC connection missing

## Quick Fixes

### Reset Everything
```bash
# Kill all processes
pkill -f "roo-daemon"
pkill -f "roo-cli"
tmux kill-session -t roo

# Restart from scratch
npm run tmux
```

### Check Full Chain
```bash
# 1. Verify code-server is running with IPC
ps aux | grep code-server
echo $ROO_CODE_IPC_SOCKET_PATH

# 2. Check socket exists
ls -la /tmp/roo-code-ipc.sock

# 3. Test IPC connection
npm test

# 4. Start daemon and CLI
npm run tmux
```

### Manual Testing
```bash
# Terminal 1: Start daemon with debug
ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" node roo-daemon.js

# Terminal 2: Start CLI
node roo-cli.js

# Terminal 3: Test connection
echo '{"type":"ping"}' | nc localhost 7777
```

## Getting Help

If issues persist:

1. **Check all logs** - daemon, CLI, and code-server extension
2. **Verify environment** - socket path, permissions, processes
3. **Test components** - use individual test scripts
4. **Reset completely** - kill all processes and restart

The system is designed to be robust, but the connection chain (CLI → Daemon → IPC → Roo) has multiple points that can fail. Work through each step systematically to identify where the issue occurs.