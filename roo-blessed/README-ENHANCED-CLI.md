# Roo CLI Enhanced - Advanced Session Management

## Overview

The Enhanced Roo CLI provides advanced session management capabilities for interacting with Roo Code through a daemon/CLI architecture. This system offers professional-grade terminal multiplexing, persistent task tracking, and improved output presentation.

## Key Features

### 🚀 Core Functionality
- **Session Management**: Persistent task tracking with JSON storage
- **Real-time Attachment**: Connect to running tasks and monitor progress
- **Working Directory Support**: Specify custom working directories for tasks
- **Enhanced Output**: Improved message presentation with deduplication
- **Multiple Connection Support**: Multiple CLI clients can connect simultaneously

### 📁 Working Directory Support
You can now specify a custom working directory when starting tasks:

```bash
# Start a task in a specific directory
roo-cli start "Fix the bug in utils.js" --cwd /path/to/project

# Start a task in the current directory (default)
roo-cli start "Create a new feature"

# Interactive mode also supports CWD
roo-cli interactive
```

### 🎯 Improved Output Presentation
The daemon now provides:
- **Message Deduplication**: Prevents repetitive log spam
- **Structured JSON Parsing**: Better formatting for complex responses
- **Emoji Indicators**: Clear visual status indicators
- **Cooldown Periods**: Smart message throttling (3-5 seconds)

## Installation & Setup

### Prerequisites
```bash
# Install dependencies
npm install net readline chalk node-ipc
```

### Environment Setup
```bash
# Set the IPC socket path (required)
export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"
```

## Usage Guide

### 1. Start the Daemon
```bash
# Basic daemon startup
node roo-daemon.js

# Custom port and host
node roo-daemon.js --port 8888 --host 0.0.0.0

# Custom IPC socket
node roo-daemon.js --socket /custom/path/to/socket
```

### 2. CLI Commands

#### Start New Tasks
```bash
# Basic task (enters interactive mode automatically)
roo-cli start "Create a web page"

# Task with custom working directory (enters interactive mode)
roo-cli start "Fix the authentication bug" --cwd /home/user/myproject

# Task with custom daemon connection (enters interactive mode)
roo-cli start "Deploy the application" --port 8888 --host remote-server
```

**Note**: The `start` command automatically enters interactive mode after starting the task, allowing you to continue the conversation immediately.

#### Session Management
```bash
# List all sessions (active and completed)
roo-cli ls

# Attach to a specific task
roo-cli attach task-1234567890

# Interactive mode
roo-cli interactive
```

#### Connection Options
```bash
# Connect to custom daemon
roo-cli --port 8888 --host localhost start "My task"

# All commands support connection options
roo-cli --port 8888 ls
roo-cli --port 8888 attach task-123
```

### 3. Interactive Mode

Interactive mode provides a persistent session for ongoing work:

```bash
roo-cli interactive
```

**Interactive Commands:**
- `/help` - Show available commands
- `/ls` - List all sessions
- `/attach <taskId>` - Attach to a specific task
- `/detach` - Detach from current task
- `/status` - Show connection status
- `/quit` or `/exit` - Exit interactive mode
- `Ctrl+C` - Exit interactive mode

**Interactive Usage:**
```
🟢 roo> Create a new React component
🚀 Started new task: task-1641234567890

🔵 roo[67890]> Add TypeScript support to the component
🤖 Roo: I'll help you add TypeScript support...

🔵 roo[67890]> /detach
🔓 Detached from current task

🟢 roo> /ls
📋 Roo Sessions
===============

Active Sessions:
 1. 🟢 task-1641234567890
    Prompt: Create a new React component
    Age: 2m 15s, Last activity: 30s ago
```

## Session Management

### Session Storage
Sessions are automatically saved to `~/.roo_sessions.json` and include:
- Task ID and prompt
- Start time and last activity
- Current status (active, completed, aborted)
- Message history
- Working directory information

### Session States
- **🟢 Active**: Task is currently running
- **✅ Completed**: Task finished successfully  
- **❌ Aborted**: Task was cancelled or failed
- **⏸️ Paused**: Task is temporarily paused

### Automatic Cleanup
- Completed sessions older than 24 hours are automatically cleaned up
- Session cache is maintained for optimal performance
- Message history is limited to prevent memory issues

## Advanced Features

### Working Directory Configuration
The `--cwd` option allows you to specify where Roo should execute tasks:

```bash
# Web development project
roo-cli start "Add responsive design" --cwd /home/user/webapp

# Backend API project  
roo-cli start "Implement authentication" --cwd /home/user/api

# Documentation updates
roo-cli start "Update README" --cwd /home/user/docs
```

### Output Presentation Improvements

**Before (repetitive logs):**
```
2025-07-07T22:46:38.109Z [INFO] Roo: What would you like to work on in the deezel project?
2025-07-07T22:46:38.228Z [INFO] Roo: What would you like to work on in the deezel project?
2025-07-07T22:46:38.268Z [INFO] Roo: What would you like to work on in the deezel project?
```

**After (clean, deduplicated):**
```
2025-07-07T22:46:38.109Z [INFO] 🤖 Roo: What would you like to work on in the deezel project?
2025-07-07T22:46:40.130Z [INFO] ❓ What would you like to work on in the deezel project?
2025-07-07T22:46:40.130Z [INFO] 💡 Suggestions:
2025-07-07T22:46:40.130Z [INFO]    1. Implement new features or fix bugs in the codebase [code]
2025-07-07T22:46:40.130Z [INFO]    2. Investigate and fix issues with existing functionality [debug]
```

### Multiple Client Support
Multiple CLI clients can connect to the same daemon:

```bash
# Terminal 1: Start daemon
node roo-daemon.js

# Terminal 2: Interactive session
roo-cli interactive

# Terminal 3: Quick task
roo-cli start "Quick fix" --cwd /project

# Terminal 4: Monitor sessions
roo-cli ls
```

## Configuration Options

### Daemon Options
```bash
node roo-daemon.js [options]

Options:
  --port <port>        TCP port to listen on (default: 7777)
  --socket <path>      IPC socket path (default: ROO_CODE_IPC_SOCKET_PATH env var)
  --host <host>        TCP host to bind to (default: localhost)
  --help               Show help message
```

### CLI Options
```bash
roo-cli <command> [options]

Global Options:
  --port <port>        TCP port to connect to (default: 7777)
  --host <host>        TCP host to connect to (default: localhost)
  --cwd <directory>    Working directory for the task (default: current directory)

Commands:
  start "prompt"       Start a new Roo task
  ls, list            List all sessions (active and completed)
  attach <taskId>     Attach to an active task session
  interactive, i      Start interactive mode
  help                Show help message
```

## Testing

### Run Feature Tests
```bash
# Test enhanced features
node test-enhanced-features.js

# Test basic daemon/CLI functionality
node test-daemon-cli.js
```

### Manual Testing
```bash
# 1. Start daemon
node roo-daemon.js

# 2. Test CWD functionality
roo-cli start "Test task" --cwd /tmp

# 3. Test session management
roo-cli ls
roo-cli attach <taskId>

# 4. Test interactive mode
roo-cli interactive
```

## Troubleshooting

### Common Issues

**Daemon won't start:**
```bash
# Check IPC socket path
echo $ROO_CODE_IPC_SOCKET_PATH
ls -la /tmp/roo-code-ipc.sock

# Verify Roo Code extension is running
```

**CLI can't connect:**
```bash
# Check daemon is running
netstat -ln | grep 7777

# Test connection
roo-cli --port 7777 ls
```

**CWD not working:**
```bash
# Verify directory exists
ls -la /path/to/directory

# Check daemon logs for CWD messages
# Look for: "📁 Working directory: /path/to/directory"
```

**Repetitive output:**
- The enhanced daemon includes automatic deduplication
- Messages are throttled with 3-5 second cooldowns
- Check daemon version includes latest improvements

### Debug Mode
```bash
# Enable verbose logging
DEBUG=1 node roo-daemon.js

# Monitor daemon logs
tail -f daemon.log
```

## Architecture

### System Components
1. **Roo Code Extension**: VSCode extension with IPC server
2. **Roo Daemon**: TCP bridge server (roo-daemon.js)
3. **Enhanced CLI**: Advanced client (roo-cli-enhanced.js)
4. **Session Manager**: Persistent storage and tracking

### Data Flow
```
Roo Extension (IPC) ↔ Daemon (TCP) ↔ CLI Client(s)
                                   ↕
                            Session Storage
                           (~/.roo_sessions.json)
```

### Message Protocol
```javascript
// Task with CWD
{
  type: 'TaskCommand',
  origin: 'client',
  clientId: 'client-123',
  data: {
    commandName: 'StartNewTask',
    data: {
      text: 'Task prompt',
      configuration: {
        workingDirectory: '/path/to/project'
      },
      images: [],
      newTab: false
    }
  }
}
```

## Contributing

### Development Setup
```bash
# Clone and setup
git clone <repository>
cd roo-blessed

# Install dependencies
npm install

# Run tests
node test-enhanced-features.js
```

### Adding Features
1. Update daemon (`roo-daemon.js`) for server-side changes
2. Update CLI (`roo-cli-enhanced.js`) for client-side changes
3. Add tests to verify functionality
4. Update documentation

## License

This project is part of the Roo Code ecosystem. See main project license for details.