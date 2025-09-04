# Roo Blessed Client - Complete Setup Guide

This guide will help you set up the Roo Blessed terminal client to connect to your running Roo Code extension via IPC.

## Quick Start

1. **Run the setup script:**
   ```bash
   cd roo-blessed
   npm run setup
   ```

2. **Set the environment variable:**
   ```bash
   source ./setup-env.sh
   ```

3. **Restart your code-server with the environment variable:**
   ```bash
   # Option 1: Restart with the variable
   ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" code-server
   
   # Option 2: Export and restart
   export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"
   code-server
   ```

4. **Test the connection:**
   ```bash
   npm test
   ```

5. **Start the Blessed client:**
   ```bash
   npm start
   ```

## Detailed Setup Process

### Step 1: Understand the Architecture

The Roo Blessed client connects to the Roo Code VSCode extension via Inter-Process Communication (IPC) using Unix domain sockets. The extension creates an IPC server only when the `ROO_CODE_IPC_SOCKET_PATH` environment variable is set.

### Step 2: Configure the Environment

The setup script creates:
- `.env` file with the socket path
- `setup-env.sh` script to source the environment
- Instructions for restarting code-server

### Step 3: Restart Code-Server

**Important:** You must restart your code-server instance with the environment variable set. The extension reads this variable during activation.

```bash
# Method 1: Inline environment variable
ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" code-server --bind-addr 0.0.0.0:8080

# Method 2: Export then start
export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"
code-server --bind-addr 0.0.0.0:8080

# Method 3: Add to your shell profile
echo 'export ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock"' >> ~/.bashrc
source ~/.bashrc
code-server --bind-addr 0.0.0.0:8080
```

### Step 4: Verify Extension Loading

1. Open your code-server web interface
2. Check that the Roo Code extension is active
3. Look for IPC-related messages in the extension output panel
4. The socket file should appear at `/tmp/roo-code-ipc.sock`

### Step 5: Test Connection

```bash
cd roo-blessed
npm test
```

Expected output when working:
```
🔍 Testing Roo Code IPC Connection...
📍 Socket path: /tmp/roo-code-ipc.sock
✅ Socket file exists
📊 Socket file stats:
   Size: 0 bytes
   Modified: [timestamp]
   Mode: 140777
✅ File is a valid socket
🎉 Connection test passed!
   You can now run: npm start
```

### Step 6: Start the Client

```bash
npm start
```

## Using the Terminal Interface

Once connected, you'll see a 4-panel interface:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Roo Blessed Client - Connected               │
├─────────────────────────────┬───────────────────────────────────┤
│         Current Task        │           Messages                │
│                             │                                   │
│  Shows active task info     │  Conversation with Roo            │
│  and progress               │  Real-time message updates        │
│                             │                                   │
├─────────────────────────────┼───────────────────────────────────┤
│           Logs              │         Input Box                 │
│                             │                                   │
│  IPC communication logs     │  Type prompts here                │
│  Debug information          │  Ctrl+Enter to send               │
│                             │                                   │
└─────────────────────────────┴───────────────────────────────────┘
```

### Key Controls:
- **Ctrl+Enter**: Send message to Roo
- **h**: Show help
- **Ctrl+C, q, Escape**: Quit

## Parallel Usage

The beauty of this setup is that you can:

1. **Keep your web UI open** in your browser to see visual changes
2. **Use the terminal client** to send commands and monitor progress
3. **Watch both interfaces simultaneously** - perfect for remote development over SSH

## Troubleshooting

### "Socket file does not exist"
- Ensure `ROO_CODE_IPC_SOCKET_PATH` is set before starting code-server
- Restart code-server completely (not just reload window)
- Check the extension output panel for IPC-related messages

### "Permission denied"
- Check file permissions on the socket
- Ensure the directory `/tmp` is writable
- Try a different socket path in your home directory

### "Connection refused"
- The extension may not have IPC enabled
- Verify the environment variable is set in the code-server process
- Check extension logs for errors

### Extension not loading
- Ensure Roo Code extension is installed and enabled
- Check VSCode extension host logs
- Try disabling/re-enabling the extension

## SSH Usage

This client is perfect for SSH scenarios:

```bash
# SSH to your server
ssh user@your-server

# Navigate to the project
cd /path/to/Roo-Code/roo-blessed

# Set up and start
npm run setup
source ./setup-env.sh
# (restart code-server with the environment variable)
npm start
```

Now you can control Roo from your SSH terminal while keeping the web interface open in your local browser!

## Advanced Configuration

### Custom Socket Path
```bash
export ROO_CODE_IPC_SOCKET_PATH="/custom/path/roo.sock"
npm start /custom/path/roo.sock
```

### Multiple Instances
You can run multiple Blessed clients connected to the same Roo instance - they'll all receive the same events and can send commands.

### Automation
The client can be scripted or used in automation workflows:
```bash
echo "Create a simple web page" | npm start
```

## Development

To modify the client:
```bash
npm run dev  # Auto-restart on changes
```

The client is built with:
- **Blessed**: Terminal UI framework
- **node-ipc**: IPC communication
- **chalk**: Terminal colors

## Support

If you encounter issues:
1. Check this guide thoroughly
2. Verify environment variable setup
3. Test with `npm test`
4. Check extension logs in VSCode
5. Try a fresh code-server restart