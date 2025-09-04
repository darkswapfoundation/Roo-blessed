#!/usr/bin/env node

/*
 * Roo Blessed Terminal UI Client
 * 
 * This application connects to a running Roo Code VSCode extension via IPC
 * and provides a terminal-based interface for monitoring and controlling Roo sessions.
 * 
 * Features:
 * - Real-time task monitoring
 * - Send prompts to Roo
 * - View task history
 * - Monitor task events (started, completed, aborted)
 * 
 * Usage:
 *   node index.js [socket_path]
 * 
 * The socket path defaults to the ROO_CODE_IPC_SOCKET_PATH environment variable
 * or can be provided as a command line argument.
 */

import blessed from 'blessed';
import ipc from 'node-ipc';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// IPC Configuration
ipc.config.silent = true;
ipc.config.retry = 1500;

export class RooBlessedClient {
    constructor() {
        this.screen = null;
        this.connected = false;
        this.isReady = false;
        this.clientId = null;
        this.currentTask = null;
        this.taskHistory = [];
        this.messages = [];
        this.logs = [];
        this.socketPath = null;
        
        // UI Components
        this.statusBox = null;
        this.messagesBox = null;
        this.inputBox = null;
        this.taskBox = null;
        this.logBox = null;
        
        this.setupUI();
        this.log('🚀 Roo Blessed Client starting...');
        this.log('📋 Use Ctrl+Enter to send messages, h for help, Ctrl+C to quit');
        this.setupIPC();
    }

    setupUI() {
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Roo Blessed Client',
            dockBorders: true,
            fullUnicode: true,
            autoPadding: true
        });

        // Status bar at top
        this.statusBox = blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            content: '{center}Roo Blessed Client - Disconnected{/center}',
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                bg: 'red',
                border: {
                    fg: '#f0f0f0'
                }
            }
        });

        // Task info box (left side)
        this.taskBox = blessed.box({
            top: 3,
            left: 0,
            width: '50%',
            height: '50%-3',
            content: 'No active task',
            tags: true,
            border: {
                type: 'line'
            },
            label: ' Current Task ',
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'cyan'
                },
                style: {
                    inverse: true
                }
            }
        });

        // Messages box (right side)
        this.messagesBox = blessed.box({
            top: 3,
            left: '50%',
            width: '50%',
            height: '50%-3',
            content: 'Waiting for messages...',
            tags: true,
            border: {
                type: 'line'
            },
            label: ' Messages ',
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'cyan'
                },
                style: {
                    inverse: true
                }
            }
        });

        // Log box (bottom left)
        this.logBox = blessed.box({
            top: '50%',
            left: 0,
            width: '50%',
            height: '50%-3',
            content: '',
            tags: true,
            border: {
                type: 'line'
            },
            label: ' Logs ',
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: {
                ch: ' ',
                track: {
                    bg: 'cyan'
                },
                style: {
                    inverse: true
                }
            }
        });

        // Input box (bottom right)
        this.inputBox = blessed.textarea({
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%-3',
            border: {
                type: 'line'
            },
            label: ' Send Message to Roo (Ctrl+Q to send, Ctrl+C to quit) ',
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            },
            inputOnFocus: true,
            scrollable: true,
            mouse: true
        });
        this.inputBox.options.readOnly = true; // Start as read-only

        // Add all components to screen
        this.screen.append(this.statusBox);
        this.screen.append(this.taskBox);
        this.screen.append(this.messagesBox);
        this.screen.append(this.logBox);
        this.screen.append(this.inputBox);

        // Focus input box
        // Key bindings
        this.inputBox.key(['C-q'], () => {
            this.sendMessage();
        });

        this.inputBox.key(['C-c'], () => {
            this.disconnect();
            return process.exit(0);
        });

        // Help text
        this.screen.key(['h', 'H'], () => {
            this.showHelp();
        });

        // Global quit
        this.screen.key(['C-c'], () => {
            this.disconnect();
            return process.exit(0);
        });

        // Render screen
        this.screen.render();
    }

    setupIPC() {
        // Determine socket path
        this.socketPath = process.argv[2] || process.env.ROO_CODE_IPC_SOCKET_PATH;
        
        if (!this.socketPath) {
            this.log('ERROR: No socket path provided. Set ROO_CODE_IPC_SOCKET_PATH or provide as argument.');
            this.log('Usage: node index.js [socket_path]');
            this.updateStatus('No socket path provided', 'red');
            this.log('Please set ROO_CODE_IPC_SOCKET_PATH environment variable or provide socket path as argument.');
            return;
        }

        this.log(`Attempting to connect to: ${this.socketPath}`);

        // Check if socket exists
        if (!existsSync(this.socketPath)) {
            this.log(`ERROR: Socket file does not exist: ${this.socketPath}`);
            this.log('Make sure Roo Code extension is running with IPC enabled.');
            this.updateStatus('Socket file not found - waiting...', 'red');
            this.log('Waiting for socket to be created...');
            this.log('Start code-server with: ROO_CODE_IPC_SOCKET_PATH="/tmp/roo-code-ipc.sock" code-server');
            
            // Set up a watcher to retry connection when socket is created
            this.watchForSocket();
            return;
        }

        // Socket exists, connect to it
        this.connectToSocket();
    }

    watchForSocket() {
        // Poll for socket existence every 2 seconds
        this.socketWatcher = setInterval(() => {
            if (existsSync(this.socketPath)) {
                this.log('Socket file detected! Attempting to connect...');
                clearInterval(this.socketWatcher);
                this.connectToSocket();
            } else {
                this.log(`Still waiting for socket: ${this.socketPath}`);
            }
        }, 2000);
    }

    connectToSocket() {
        // Connect to IPC server
        const clientId = `roo-blessed-${Date.now()}`;
        this.ipcClientId = clientId;
        ipc.config.id = clientId;
        
        ipc.connectTo('world', this.socketPath, () => {
        	ipc.of.world.on('connect', () => {
        		this.onConnect();
      
        		ipc.of.world.on('disconnect', () => {
        			this.onDisconnect();
        		});
      
        		ipc.of.world.on('message', (data) => {
        			this.onMessage(data);
        		});
      
        		ipc.of.world.on('error', (err) => {
        			this.log(`IPC Error: ${err.message}`);
        		});
        	});
        });
    }

    onConnect() {
        this.connected = true;
        this.updateStatus('Connected to Roo Code', 'green');
        this.log('✅ IPC: Connected to Roo Code server');
        this.log(`✅ IPC: Client ID: ${this.ipcClientId}`);
        this.log('✅ IPC: Sending registration message...');
        this.inputBox.options.readOnly = true;

        const command = {
            type: 'TaskCommand',
            origin: 'client',
            clientId: this.ipcClientId,
            data: {
                commandName: 'StartNewTask',
                data: {
                    text: 'init',
                    configuration: {
                        "apiProvider": "bedrock"
                    },
                },
            },
        };
        ipc.of.world.emit('message', command);

        this.inputBox.focus();
        setTimeout(() => this.screen.render(), 100);
    }

    onDisconnect() {
        this.connected = false;
        this.clientId = null;
        this.updateStatus('Disconnected from Roo Code', 'red');
        this.log('❌ IPC: Disconnected from Roo Code server');
        this.log('❌ IPC: Will attempt to reconnect...');
    }

    onMessage(data) {
        try {
            this.log(`✅ IPC: Message received: ${JSON.stringify(data)}`);
            if (data.type.toLowerCase() === 'ack') {
                this.clientId = data.data.clientId;
                this.isReady = true;
                this.log(`✅ IPC: Received client ID: ${this.clientId}`);
                this.updateStatus(`Connected (ID: ${this.clientId})`, 'green');
                this.log('🎉 Ready to send messages! Type in the input box and press Ctrl+Q');
                this.inputBox.options.readOnly = false;
                this.inputBox.focus();
                this.screen.render();
            } else if (data.type === 'TaskEvent') {
                this.log(`✅ IPC: Handling task event: ${data.data.eventName}`);
                this.handleTaskEvent(data.data);
            } else {
                this.log(`❓ IPC: Unknown message type: ${data.type}`);
            }
        } catch (error) {
            this.log(`❌ IPC: Error processing message: ${error.message}`);
            this.log(`❌ IPC: Error stack: ${error.stack}`);
        }
    }

    handleTaskEvent(event) {
        const { eventName, payload } = event;
        
        switch (eventName) {
            case 'taskStarted':
                this.currentTask = payload[0]; // taskId
                this.updateTaskInfo(`Task Started: ${this.currentTask}`);
                this.log(`Task started: ${this.currentTask}`);
                break;
            case 'taskCompleted':
                const [taskId, tokenUsage, toolUsage, metadata] = payload;
                this.updateTaskInfo(`Task Completed: ${taskId}\nTokens: ${JSON.stringify(tokenUsage, null, 2)}\nTools: ${JSON.stringify(toolUsage, null, 2)}`);
                this.log(`Task completed: ${taskId}`);
                this.currentTask = null;
                break;
            case 'taskAborted':
                this.updateTaskInfo(`Task Aborted: ${payload[0]}`);
                this.log(`Task aborted: ${payload[0]}`);
                this.currentTask = null;
                break;
            case 'message':
                const messageData = payload[0];
                this.addMessage(messageData);
                break;
            default:
                this.log(`Unknown task event: ${eventName}`);
        }
    }

    sendMessage() {
        if (this.inputBox.options.readOnly) {
            this.log('Input is read-only, ignoring send command.');
            return;
        }
        const text = this.inputBox.getValue().trim();
        this.log(`sendMessage() called with text: "${text}"`);
        
        if (!text) {
            this.log('No text to send - input is empty');
            return;
        }

        if (!this.connected) {
            this.log('ERROR: Not connected to Roo Code - cannot send message');
            this.updateStatus('Not connected - cannot send message', 'red');
            return;
        }

        if (!this.isReady) {
            this.log('ERROR: Not ready to send - connection not fully established');
            return;
        }

        try {
            // Send start new task command
            const command = {
                type: 'TaskCommand',
                origin: 'client',
                clientId: this.clientId,
                data: {
                    commandName: 'StartNewTask',
                    data: {
                        text: text,
                        configuration: {
                            // Use default configuration
                        }
                    }
                }
            };

            this.log(`Sending command: ${JSON.stringify(command, null, 2)}`);
            ipc.of.world.emit('message', command);
            this.log(`✅ Successfully sent message: "${text}"`);
            this.addUserMessage(text);
            
            // Clear input and update UI
            this.inputBox.clearValue();
            this.updateStatus(`Message sent: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`, 'green');
            this.inputBox.focus();
            this.screen.render();
        } catch (error) {
            this.log(`❌ Error sending message: ${error.message}`);
            this.log(`Error stack: ${error.stack}`);
            this.updateStatus('Error sending message', 'red');
        }
    }

    updateStatus(message, color = 'white') {
        this.statusBox.setContent(`{center}Roo Blessed Client - ${message}{/center}`);
        this.statusBox.style.bg = color === 'green' ? 'green' : 'red';
        this.screen.render();
    }

    updateTaskInfo(info) {
        this.taskBox.setContent(info);
        this.taskBox.scrollTo(this.taskBox.getScrollHeight());
        this.screen.render();
    }

    addMessage(messageData) {
        const timestamp = new Date().toLocaleTimeString();
        let content = `[${timestamp}] `;
        
        if (messageData.message) {
            if (messageData.message.type === 'say') {
                content += `Roo: ${messageData.message.text || ''}`;
            } else if (messageData.message.type === 'ask') {
                content += `Roo asks: ${messageData.message.text || ''}`;
            } else {
                content += `${messageData.message.type}: ${JSON.stringify(messageData.message, null, 2)}`;
            }
        } else {
            content += JSON.stringify(messageData, null, 2);
        }

        this.messages.push(content);
        
        // Keep only last 100 messages
        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }

        this.messagesBox.setContent(this.messages.join('\n'));
        this.messagesBox.scrollTo(this.messagesBox.getScrollHeight());
        this.screen.render();
    }

    addUserMessage(text) {
        const timestamp = new Date().toLocaleTimeString();
        const content = `[${timestamp}] You: ${text}`;
        this.messages.push(content);

        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }

        this.messagesBox.setContent(this.messages.join('\n'));
        this.messagesBox.scrollTo(this.messagesBox.getScrollHeight());
        this.screen.render();
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        // Initialize logs array if not exists
        if (!this.logs) {
            this.logs = [];
        }
        
        // Add to logs array
        this.logs.push(logMessage);
        
        // Keep only last 100 log entries
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }
        
        // Update log box content
        this.logBox.setContent(this.logs.join('\n'));
        this.logBox.scrollTo(this.logBox.getScrollHeight());
        this.screen.render();
        
        // Also log to console for debugging
        // console.log(logMessage);
    }

    showHelp() {
        const helpText = `
Roo Blessed Client Help
======================

Key Bindings:
- Ctrl+Q: Send message to Roo
- Ctrl+C: Quit application
- h, H: Show this help

Usage:
1. Type your message/prompt in the input box (bottom right)
2. Press Ctrl+Q to send it to Roo
3. Watch the task progress in the Current Task box
4. Monitor messages in the Messages box
5. Check logs in the Logs box

The application connects to the running Roo Code extension via IPC socket.
Make sure the extension is running with IPC enabled (ROO_CODE_IPC_SOCKET_PATH).

Press any key to close this help...
        `;

        const helpBox = blessed.message({
            parent: this.screen,
            top: 'center',
            left: 'center',
            width: '80%',
            height: '80%',
            content: helpText,
            tags: true,
            border: {
                type: 'line'
            },
            style: {
                fg: 'white',
                border: {
                    fg: '#f0f0f0'
                }
            }
        });

        helpBox.focus();
        this.screen.render();

        helpBox.key(['escape', 'enter', 'space'], () => {
            helpBox.destroy();
            this.inputBox.focus();
            this.screen.render();
        });
    }

    disconnect() {
        if (this.socketWatcher) {
            clearInterval(this.socketWatcher);
        }
        if (this.connected) {
            ipc.disconnect(this.ipcClientId);
        }
    }
}

// Start the application if not imported
if (import.meta.url.startsWith('file:') && process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('Starting Roo Blessed Client...');
    const client = new RooBlessedClient();

    // Handle process termination
    process.on('SIGINT', () => {
        client.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        client.disconnect();
        process.exit(0);
    });
}