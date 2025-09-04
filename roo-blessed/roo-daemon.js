#!/usr/bin/env node

/*
 * Roo Daemon - TCP Server Bridge to Roo Code IPC
 * 
 * This daemon connects to the Roo Code VSCode extension via IPC
 * and exposes a TCP server for CLI clients to connect to.
 * 
 * Features:
 * - Connects to Roo Code extension via Unix socket
 * - Exposes TCP server for CLI clients
 * - Broadcasts Roo events to all connected clients
 * - Handles multiple concurrent CLI connections
 * - Real-time logging and status updates
 * 
 * Usage:
 *   node roo-daemon.js [options]
 * 
 * Options:
 *   --port <port>        TCP port to listen on (default: 7777)
 *   --socket <path>      IPC socket path (default: ROO_CODE_IPC_SOCKET_PATH env var)
 *   --host <host>        TCP host to bind to (default: localhost)
 */

import net from 'net';
import ipc from 'node-ipc';
import { existsSync } from 'fs';
import chalk from 'chalk';

// Configuration
const DEFAULT_PORT = 7777;
const DEFAULT_HOST = 'localhost';

class RooDaemon {
    constructor(options = {}) {
        this.port = options.port || DEFAULT_PORT;
        this.host = options.host || DEFAULT_HOST;
        this.socketPath = options.socket || process.env.ROO_CODE_IPC_SOCKET_PATH;
        
        // State
        this.connected = false;
        this.clientId = null;
        this.currentTask = null;
        this.clients = new Set();
        this.messageHistory = [];
        
        // Message deduplication
        this.messageCache = new Map();
        this.lastMessage = null;
        
        // Servers
        this.tcpServer = null;
        this.ipcClientId = null;
        
        this.setupIPC();
        this.setupTCPServer();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = level === 'error' ? chalk.red('[ERROR]') : 
                      level === 'warn' ? chalk.yellow('[WARN]') : 
                      level === 'success' ? chalk.green('[SUCCESS]') :
                      chalk.blue('[INFO]');
        
        console.log(`${chalk.gray(timestamp)} ${prefix} ${message}`);
    }

    setupIPC() {
        if (!this.socketPath) {
            this.log('No IPC socket path provided. Set ROO_CODE_IPC_SOCKET_PATH environment variable.', 'error');
            this.log('Usage: ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" node roo-daemon.js', 'warn');
            return;
        }

        this.log(`Attempting to connect to Roo IPC: ${this.socketPath}`);

        if (!existsSync(this.socketPath)) {
            this.log(`IPC socket does not exist: ${this.socketPath}`, 'error');
            this.log('Make sure Roo Code extension is running with IPC enabled.', 'warn');
            this.log('Waiting for socket to be created...', 'warn');
            this.watchForSocket();
            return;
        }

        this.connectToIPC();
    }

    watchForSocket() {
        this.socketWatcher = setInterval(() => {
            if (existsSync(this.socketPath)) {
                this.log('IPC socket detected! Connecting...', 'success');
                clearInterval(this.socketWatcher);
                this.connectToIPC();
            }
        }, 2000);
    }

    connectToIPC() {
        ipc.config.silent = true;
        ipc.config.retry = 1500;

        const clientId = `roo-daemon-${Date.now()}`;
        this.ipcClientId = clientId;

        ipc.connectTo(clientId, this.socketPath, () => {
            ipc.of[clientId].on('connect', () => {
                this.onIPCConnect();
            });

            ipc.of[clientId].on('disconnect', () => {
                this.onIPCDisconnect();
            });

            ipc.of[clientId].on('message', (data) => {
                this.onIPCMessage(data);
            });

            ipc.of[clientId].on('error', (err) => {
                this.log(`IPC Error: ${err.message}`, 'error');
            });
        });
    }

    onIPCConnect() {
        this.connected = true;
        this.log('Connected to Roo Code IPC server', 'success');
        this.broadcastToClients({
            type: 'status',
            data: { connected: true, message: 'Connected to Roo Code' }
        });
    }

    onIPCDisconnect() {
        this.connected = false;
        this.clientId = null;
        this.log('Disconnected from Roo Code IPC server', 'warn');
        this.broadcastToClients({
            type: 'status',
            data: { connected: false, message: 'Disconnected from Roo Code' }
        });
    }

    onIPCMessage(data) {
        this.log(`Received IPC message: ${data.type}`);
        
        if (data.type === 'ack' || data.type === 'Ack') {
            // Handle both lowercase and uppercase variants
            this.clientId = data.data?.clientId || data.clientId;
            this.log(`Received client ID: ${this.clientId}`, 'success');
            this.broadcastToClients({
                type: 'ready',
                data: { clientId: this.clientId, message: 'Ready to accept commands' }
            });
        } else if (data.type === 'taskEvent' || data.type === 'TaskEvent') {
            // Handle both lowercase and uppercase variants
            this.handleTaskEvent(data.data || data);
        } else {
            this.log(`Unknown IPC message type: ${data.type}`, 'warn');
        }

        // Store message in history and broadcast to clients
        this.messageHistory.push(data);
        if (this.messageHistory.length > 1000) {
            this.messageHistory = this.messageHistory.slice(-1000);
        }

        this.broadcastToClients({
            type: 'ipcMessage',
            data: data
        });
    }

    handleTaskEvent(event) {
        const { eventName, payload } = event;
        
        switch (eventName) {
            case 'taskStarted':
                this.currentTask = payload[0];
                this.log(`🏃 Task started: ${this.currentTask}`, 'success');
                break;
                
            case 'taskCompleted':
                const [taskId, tokenUsage, toolUsage, metadata] = payload;
                this.log(`✅ Task completed: ${taskId}`, 'success');
                if (tokenUsage && tokenUsage.totalTokens) {
                    this.log(`📊 Tokens used: ${tokenUsage.totalTokens}`, 'info');
                }
                this.currentTask = null;
                break;
                
            case 'taskAborted':
                this.log(`❌ Task aborted: ${payload[0]}`, 'warn');
                this.currentTask = null;
                break;
                
            case 'message':
                const messageData = payload[0];
                if (messageData.message) {
                    this.formatAndLogMessage(messageData.message);
                }
                break;
                
            case 'taskTokenUsageUpdated':
                // Skip logging token updates to reduce noise
                break;
                
            default:
                this.log(`📋 ${eventName}`, 'info');
        }
    }

    formatAndLogMessage(message) {
        if (!message) return;
        
        // Handle different message types
        switch (message.type) {
            case 'say':
                if (message.text) {
                    // Check if it's JSON data that should be formatted
                    if (message.text.startsWith('{') && message.text.includes('question')) {
                        try {
                            const data = JSON.parse(message.text);
                            this.formatQuestionMessage(data);
                        } catch {
                            this.logWithDeduplication(`🤖 Roo: ${message.text}`, 'info', message.text);
                        }
                    } else {
                        // Enhanced deduplication for regular messages
                        this.logWithDeduplication(`🤖 Roo: ${message.text}`, 'info', message.text);
                    }
                }
                break;
                
            case 'ask':
                if (message.text) {
                    this.logWithDeduplication(`❓ Roo asks: ${message.text}`, 'warn', `ask:${message.text}`);
                }
                break;
                
            case 'tool':
                if (message.tool) {
                    this.log(`🔧 Tool: ${message.tool}`, 'info');
                }
                break;
                
            default:
                if (message.text) {
                    this.logWithDeduplication(`💬 ${message.type}: ${message.text}`, 'info', `${message.type}:${message.text}`);
                }
        }
    }

    logWithDeduplication(message, level, key) {
        const now = Date.now();
        const cooldownPeriod = 3000; // 3 seconds
        
        if (!this.messageCache.has(key) || (now - this.messageCache.get(key)) > cooldownPeriod) {
            this.log(message, level);
            this.messageCache.set(key, now);
            
            // Clean up old cache entries periodically
            if (this.messageCache.size > 100) {
                const cutoff = now - (cooldownPeriod * 2);
                for (const [cacheKey, timestamp] of this.messageCache.entries()) {
                    if (timestamp < cutoff) {
                        this.messageCache.delete(cacheKey);
                    }
                }
            }
        }
    }

    formatQuestionMessage(data) {
        if (data.question) {
            const questionKey = `question:${data.question}`;
            const now = Date.now();
            
            // Only show question if we haven't seen it recently
            if (!this.messageCache.has(questionKey) || (now - this.messageCache.get(questionKey)) > 5000) {
                this.log(`❓ ${data.question}`, 'warn');
                
                if (data.suggest && Array.isArray(data.suggest)) {
                    this.log(`💡 Suggestions:`, 'info');
                    data.suggest.forEach((suggestion, index) => {
                        const mode = suggestion.mode ? ` [${suggestion.mode}]` : '';
                        this.log(`   ${index + 1}. ${suggestion.answer}${mode}`, 'info');
                    });
                }
                
                this.messageCache.set(questionKey, now);
            }
        }
    }

    setupTCPServer() {
        this.tcpServer = net.createServer((socket) => {
            this.handleClientConnection(socket);
        });

        this.tcpServer.listen(this.port, this.host, () => {
            this.log(`TCP server listening on ${this.host}:${this.port}`, 'success');
            this.log(`CLI clients can connect with: node roo-cli.js --port ${this.port}`, 'info');
        });

        this.tcpServer.on('error', (err) => {
            this.log(`TCP server error: ${err.message}`, 'error');
        });
    }

    handleClientConnection(socket) {
        const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
        this.log(`CLI client connected: ${clientAddr}`, 'success');
        
        this.clients.add(socket);

        // Send current status to new client
        this.sendToClient(socket, {
            type: 'welcome',
            data: {
                connected: this.connected,
                clientId: this.clientId,
                currentTask: this.currentTask,
                messageHistory: this.messageHistory.slice(-10) // Last 10 messages
            }
        });

        // Send additional status if not fully connected
        if (!this.connected || !this.clientId) {
            this.sendToClient(socket, {
                type: 'status',
                data: {
                    connected: false,
                    message: this.connected ?
                        'Connected to Roo IPC but waiting for acknowledgment' :
                        'Not connected to Roo IPC - check ROO_CODE_IPC_SOCKET_PATH'
                }
            });
        }

        socket.on('data', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleClientMessage(socket, message);
            } catch (error) {
                this.log(`Invalid JSON from client ${clientAddr}: ${error.message}`, 'error');
            }
        });

        socket.on('close', () => {
            this.log(`CLI client disconnected: ${clientAddr}`, 'warn');
            this.clients.delete(socket);
        });

        socket.on('error', (err) => {
            this.log(`Client error ${clientAddr}: ${err.message}`, 'error');
            this.clients.delete(socket);
        });
    }

    handleClientMessage(socket, message) {
        if (message.type === 'sendTask') {
            this.sendTaskToRoo(message.data.text, message.data.cwd);
        } else if (message.type === 'ping') {
            this.sendToClient(socket, { type: 'pong', data: { timestamp: Date.now() } });
        } else {
            this.log(`Unknown client message type: ${message.type}`, 'warn');
        }
    }

    sendTaskToRoo(text, cwd) {
        if (!this.connected) {
            this.log('Cannot send task: not connected to Roo Code', 'error');
            this.broadcastToClients({
                type: 'error',
                data: { message: 'Not connected to Roo Code' }
            });
            return;
        }

        if (!this.clientId) {
            this.log('Cannot send task: no client ID', 'error');
            this.broadcastToClients({
                type: 'error',
                data: { message: 'Connection not fully established' }
            });
            return;
        }

        try {
            // Use the correct TaskCommand format from Roo source code
            const configuration = {};
            
            // Add CWD to configuration if provided
            if (cwd) {
                configuration.workingDirectory = cwd;
                this.log(`📁 Working directory: ${cwd}`, 'info');
            }
            
            const command = {
                type: 'TaskCommand',
                origin: 'client',
                clientId: this.clientId,
                data: {
                    commandName: 'StartNewTask',
                    data: {
                        text: text,
                        configuration: configuration,
                        images: [],
                        newTab: false
                    }
                }
            };

            this.log(`📤 Sending task: "${text}"`, 'success');
            if (cwd) {
                this.log(`📁 CWD: ${cwd}`, 'info');
            }
            
            ipc.of[this.ipcClientId].emit('message', command);
            
            this.broadcastToClients({
                type: 'taskSent',
                data: { text: text, cwd: cwd, timestamp: Date.now() }
            });
        } catch (error) {
            this.log(`Error sending task: ${error.message}`, 'error');
            this.broadcastToClients({
                type: 'error',
                data: { message: `Error sending task: ${error.message}` }
            });
        }
    }

    sendToClient(socket, message) {
        try {
            socket.write(JSON.stringify(message) + '\n');
        } catch (error) {
            this.log(`Error sending to client: ${error.message}`, 'error');
        }
    }

    broadcastToClients(message) {
        const data = JSON.stringify(message) + '\n';
        for (const client of this.clients) {
            try {
                client.write(data);
            } catch (error) {
                this.log(`Error broadcasting to client: ${error.message}`, 'error');
                this.clients.delete(client);
            }
        }
    }

    shutdown() {
        this.log('Shutting down daemon...', 'warn');
        
        if (this.socketWatcher) {
            clearInterval(this.socketWatcher);
        }
        
        if (this.connected) {
            ipc.disconnect(this.ipcClientId);
        }
        
        if (this.tcpServer) {
            this.tcpServer.close();
        }
        
        for (const client of this.clients) {
            client.end();
        }
        
        this.log('Daemon shutdown complete', 'success');
    }
}

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--port':
                options.port = parseInt(args[++i]);
                break;
            case '--host':
                options.host = args[++i];
                break;
            case '--socket':
                options.socket = args[++i];
                break;
            case '--help':
                console.log(`
Roo Daemon - TCP Bridge to Roo Code IPC

Usage: node roo-daemon.js [options]

Options:
  --port <port>        TCP port to listen on (default: 7777)
  --socket <path>      IPC socket path (default: ROO_CODE_IPC_SOCKET_PATH env var)
  --host <host>        TCP host to bind to (default: localhost)
  --help               Show this help message

Environment Variables:
  ROO_CODE_IPC_SOCKET_PATH    Path to Roo Code IPC socket

Example:
  ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" node roo-daemon.js --port 7777
                `);
                process.exit(0);
                break;
        }
    }
    
    return options;
}

// Start the daemon
console.log(chalk.blue.bold('🚀 Starting Roo Daemon...'));
const options = parseArgs();
const daemon = new RooDaemon(options);

// Handle graceful shutdown
process.on('SIGINT', () => {
    daemon.shutdown();
    process.exit(0);
});

process.on('SIGTERM', () => {
    daemon.shutdown();
    process.exit(0);
});