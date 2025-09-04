# Roo Blessed Terminal UI Client

A terminal-based interface for monitoring and controlling Roo Code sessions via IPC.

## Features

- **Real-time Task Monitoring**: Watch active Roo tasks and their progress
- **Send Prompts**: Send messages/prompts to Roo directly from the terminal
- **Task Events**: Monitor task lifecycle events (started, completed, aborted)
- **Message History**: View conversation history with Roo
- **Live Logs**: Real-time logging of IPC communication

## Prerequisites

1. **Running Roo Code Extension**: The VSCode extension must be running with IPC enabled
2. **IPC Socket Path**: Set the `ROO_CODE_IPC_SOCKET_PATH` environment variable or provide as argument

## Installation

```bash
cd roo-blessed
npm install
```

## Usage

### Method 1: Using Environment Variable

```bash
# Set the IPC socket path (this should be set by the Roo extension)
export ROO_CODE_IPC_SOCKET_PATH="/path/to/roo/ipc/socket"

# Start the client
npm start
```

### Method 2: Provide Socket Path as Argument

```bash
npm start /path/to/roo/ipc/socket
```

### Method 3: Development Mode (with auto-restart)

```bash
npm run dev
```

## Interface Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                    Roo Blessed Client - Connected               │
├─────────────────────────────┬───────────────────────────────────┤
│         Current Task        │           Messages                │
│                             │                                   │
│  Task info and progress     │  Conversation with Roo            │
│  appears here               │  appears here                     │
│                             │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│           Logs              │         Input Box                 │
│                             │                                   │
│  IPC communication logs     │  Type your prompts here          │
│  and debug info             │  (Ctrl+Enter to send)             │
│                             │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

## Key Bindings

- **Ctrl+Enter**: Send message/prompt to Roo
- **Ctrl+C, q, Escape**: Quit application
- **h, H**: Show help dialog

## How It Works

1. **IPC Connection**: Connects to the running Roo Code extension via Unix domain socket
2. **Event Monitoring**: Listens for task events and messages from Roo
3. **Command Sending**: Sends `startNewTask` commands to initiate new Roo sessions
4. **Real-time Updates**: Displays live updates of task progress and messages

## Enabling IPC in Roo Code Extension

The Roo Code extension needs to be configured to enable IPC communication:

1. Set the environment variable `ROO_CODE_IPC_SOCKET_PATH` to a socket file path
2. Restart VSCode or reload the extension
3. The extension will create an IPC server at the specified socket path

Example:
```bash
export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"
code-server # or restart your VSCode instance
```

## Troubleshooting

### "Socket file does not exist"
- Ensure the Roo Code extension is running
- Verify the `ROO_CODE_IPC_SOCKET_PATH` environment variable is set
- Check that the extension has IPC enabled

### "Permission denied"
- Ensure you have read/write permissions to the socket file
- Check that the socket file is accessible from your current user

### "Connection refused"
- The Roo extension may not have IPC enabled
- Try restarting the VSCode instance with the environment variable set

## Development

The client is built with:
- **Blessed**: Terminal UI framework
- **node-ipc**: IPC communication
- **chalk**: Terminal colors
- **strip-ansi**: ANSI code handling

## Use Cases

1. **Remote Monitoring**: Monitor Roo sessions running on remote servers via SSH
2. **Parallel Development**: Use terminal UI while keeping VSCode web interface open
3. **Automation**: Script interactions with Roo via the terminal interface
4. **Debugging**: Monitor IPC communication and task events in real-time

## Example Workflow

1. Start your code-server instance with Roo Code extension
2. Set the IPC socket path environment variable
3. Launch the Blessed client: `npm start`
4. Type a prompt in the input box and press Ctrl+Enter
5. Watch the task progress in the Current Task panel
6. Monitor the conversation in the Messages panel
7. Keep your web UI open to see visual changes in parallel

This allows you to control Roo from the terminal while simultaneously watching the visual interface in your browser!