# Roo Code VSCode Extension Analysis

## Extension Architecture Overview

### Main Components

1. **Extension Entry Point** (`src/extension.ts`)
   - Activates the extension and initializes core services
   - Sets up telemetry, cloud services, and MDM
   - Registers commands and webview providers
   - Returns API instance for external communication

2. **Core Provider** (`src/core/webview/ClineProvider.ts`)
   - Main webview provider managing the Roo interface
   - Handles task management and execution
   - Manages provider profiles and settings
   - Coordinates with MCP servers and marketplace

3. **API Layer** (`src/extension/api.ts`)
   - Implements RooCodeAPI interface
   - Provides programmatic access to extension functionality
   - Handles IPC communication for external clients
   - Manages task lifecycle and events

4. **IPC System** (`packages/ipc/`)
   - Server/client architecture for external communication
   - Uses Unix domain sockets for local IPC
   - Supports task commands and event broadcasting
   - Enables external tools to control Roo sessions

### Key Features

- **Task Management**: Hierarchical task system with subtasks
- **Provider Profiles**: Multiple AI provider configurations
- **Mode System**: Different operational modes (code, debug, architect, etc.)
- **MCP Integration**: Model Context Protocol server support
- **Webview UI**: React-based interface in VSCode sidebar/tab
- **Terminal Integration**: Shell command execution and monitoring
- **File Operations**: Read/write/diff operations with workspace files
- **Browser Automation**: Puppeteer-based web interaction

## Communication Architecture

### Internal Communication
- Webview ↔ Extension: VSCode webview messaging API
- Extension ↔ Tasks: Event-driven task management
- Extension ↔ MCP: Model Context Protocol for external tools

### External Communication
- IPC Server: Unix domain socket (`ROO_CODE_IPC_SOCKET_PATH`)
- API Events: Task lifecycle events (started, completed, aborted)
- Command Interface: Start/cancel/close task commands

## Current Limitations for SSH Usage

1. **Local Dependencies**: Extension runs locally in VSCode
2. **File System Access**: Direct filesystem operations assume local access
3. **Terminal Integration**: Uses local terminal instances
4. **IPC Sockets**: Unix domain sockets are local-only
5. **Browser Automation**: Puppeteer requires local Chrome/Chromium

## Potential SSH Solutions

### 1. VSCode Remote-SSH Extension Integration
- Leverage existing Remote-SSH infrastructure
- Extension would run on remote host
- Webview UI accessible through VSCode Remote-SSH
- File operations work on remote filesystem
- Terminal commands execute on remote host

### 2. Terminal UI (TUI) Application
- Create standalone TUI version using libraries like:
  - **Bubble Tea** (Go): Full TUI framework with SSH support via Wish
  - **Blessed** (Node.js): Rich terminal UI library
  - **Ink** (Node.js): React-like terminal interfaces
  - **Cursive** (Rust): With ssh_ui for SSH exposure

### 3. SSH Tunneling + Web Interface
- Run Roo as web service on remote host
- SSH tunnel to expose web interface locally
- Maintain file system and terminal access on remote
- Browser-based UI instead of VSCode webview

### 4. Hybrid Approach
- Local VSCode extension for UI
- Remote agent/daemon for execution
- SSH tunnel for communication
- File sync or remote filesystem mounting