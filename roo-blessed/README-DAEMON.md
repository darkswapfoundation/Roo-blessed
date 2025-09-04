"# Roo Daemon & CLI Architecture

A modern daemon/CLI architecture for interacting with Roo Code via tmux sessions.

## Overview

This system consists of two main components:

1. **`roo-daemon.js`** - TCP server that bridges to Roo Code IPC
2. **`roo-cli.js`** - Interactive readline-based CLI client
3. **`start-tmux.sh`** - Tmux session manager for both processes

## Architecture

```
┌─────────────────┐    Unix Socket    ┌─────────────────┐
│   Roo Code      │◄─────────────────►│   roo-daemon    │
│   Extension     │                   │   (TCP Server)  │
└─────────────────┘                   └─────────┬───────┘
                                                │ TCP
                                                │ Port 7777
                                      ┌─────────▼───────┐
                                      │    roo-cli      │
                                      │  (Readline UI)  │
                                      └─────────────────┘
```

## Quick Start

### 1. Setup Environment
```bash
cd roo-blessed
npm run setup
source ./setup-env.sh
```

### 2. Start Code-Server with IPC
```bash
# Make sure ROO_CODE_IPC_SOCKET_PATH is set
ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" code-server
```

### 3. Launch Tmux Session
```bash
npm run tmux
```

This creates a tmux session with:
- **Left pane**: Roo daemon (logs and status)
- **Right pane**: Roo CLI (interactive prompt)
- **Second window**: Monitoring/debugging

## Manual Usage

### Start Daemon Only
```bash
npm run daemon
# or
node roo-daemon.js --port 7777 --host localhost
```

### Start CLI Only (in another terminal)
```bash
npm run cli
# or
node roo-cli.js --port 7777 --host localhost
```

## CLI Usage

Once connected, you'll see a colored prompt:
- 🔴 `roo>` - Disconnected from daemon
- 🟡 `roo>` - Connected to daemon, Roo not ready
- 🟢 `roo>` - Ready to send tasks
- 🔵 `roo>` - Task in progress

### Commands

```bash
# Send tasks to Roo
create a simple web page
fix the bug in the login function
add tests for the user service

# Built-in commands
/help          # Show help
/status        # Show connection status
/clear         # Clear screen
/history       # Show command history
/ping          # Ping daemon
/quit          # Exit CLI
```

### Features

- **Command history** - Persistent across sessions
- **Tab completion** - Common phrases and commands
- **Real-time updates** - Live task progress and Roo responses
- **Colored output** - Easy to distinguish message types
- **Graceful reconnection** - Auto-reconnect to daemon

## Tmux Controls

### Window Navigation
- `Ctrl+b` then `1` - Switch to daemon/CLI window
- `Ctrl+b` then `2` - Switch to monitoring window

### Pane Navigation
- `Ctrl+b` then arrow keys - Switch between panes
- `Ctrl+b` then `z` - Zoom current pane

### Session Management
- `Ctrl+b` then `d` - Detach from session
- `tmux attach -t roo` - Reattach to session
- `tmux kill-session -t roo` - Kill session

## Configuration

### Environment Variables
```bash
ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"  # IPC socket path
DAEMON_PORT="7777"                                  # TCP port for daemon
DAEMON_HOST="localhost"                             # TCP host for daemon
SESSION_NAME="roo"                                  # Tmux session name
```

### Command Line Options

#### Daemon Options
```bash
node roo-daemon.js [options]
  --port <port>        TCP port to listen on (default: 7777)
  --socket <path>      IPC socket path (default: ROO_CODE_IPC_SOCKET_PATH)
  --host <host>        TCP host to bind to (default: localhost)
```

#### CLI Options
```bash
node roo-cli.js [options]
  --port <port>        TCP port to connect to (default: 7777)
  --host <host>        TCP host to connect to (default: localhost)
```

## Benefits Over Blessed UI

### 1. **Tmux Integration**
- Native terminal multiplexing
- Session persistence across SSH disconnections
- Standard tmux keybindings
- Easy window/pane management

### 2. **Separation of Concerns**
- Daemon handles IPC connection stability
- CLI focuses on user interaction
- Multiple CLI clients can connect to one daemon

### 3. **Better SSH Experience**
- Works perfectly over SSH
- No terminal compatibility issues
- Standard readline interface

### 4. **Debugging & Monitoring**
- Separate monitoring window
- Clear separation of logs and interaction
- Easy to add additional monitoring tools

### 5. **Flexibility**
- Can run daemon and CLI on different machines
- Easy to script and automate
- Standard TCP protocol for extensions

## Troubleshooting

### Daemon Won't Start
```bash
# Check if socket exists
ls -la /tmp/roo-code-ipc.sock

# Check if port is available
netstat -ln | grep 7777

# Check environment
echo $ROO_CODE_IPC_SOCKET_PATH
```

### CLI Won't Connect
```bash
# Test daemon is running
telnet localhost 7777

# Check daemon logs in tmux
# Switch to daemon pane and check output
```

### Tmux Session Issues
```bash
# List sessions
tmux list-sessions

# Kill stuck session
tmux kill-session -t roo

# Check tmux version
tmux -V
```

## Development

### Testing Components

```bash
# Test IPC connection
npm test

# Test UI without IPC
npm run test-ui

# Test daemon only
npm run daemon

# Test CLI only (in another terminal)
npm run cli
```

### Adding Features

1. **Daemon**: Modify `roo-daemon.js` for IPC handling
2. **CLI**: Modify `roo-cli.js` for user interface
3. **Tmux**: Modify `start-tmux.sh` for session layout

## Examples

### Basic Usage
```bash
# Start everything
npm run tmux

# In CLI pane, type:
create a todo app with React

# Watch progress in daemon pane
# Use monitoring window for additional commands
```

### Remote Development
```bash
# On server
ssh user@server
cd /path/to/roo-blessed
npm run tmux

# Detach and logout
Ctrl+b d
exit

# Later, reattach
ssh user@server
tmux attach -t roo
```

### Multiple Clients
```bash
# Terminal 1: Start daemon
npm run daemon

# Terminal 2: CLI client 1
npm run cli

# Terminal 3: CLI client 2
npm run cli

# Both CLIs receive the same Roo updates
```

This architecture provides a robust, flexible, and user-friendly way to interact with Roo Code from the terminal, especially in SSH environments.