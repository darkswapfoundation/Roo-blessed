#!/usr/bin/env node

/*
 * Roo CLI - Interactive Command Line Interface
 * 
 * This CLI connects to the Roo Daemon via TCP and provides
 * a readline-based interface for sending prompts to Roo.
 * 
 * Features:
 * - Readline interface with history and tab completion
 * - Real-time status updates from daemon
 * - Colored output for better readability
 * - Command history persistence
 * - Graceful connection handling
 * 
 * Usage:
 *   node roo-cli.js [options]
 * 
 * Options:
 *   --port <port>        TCP port to connect to (default: 7777)
 *   --host <host>        TCP host to connect to (default: localhost)
 */

import net from 'net';
import readline from 'readline';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// Configuration
const DEFAULT_PORT = 7777;
const DEFAULT_HOST = 'localhost';
const HISTORY_FILE = join(homedir(), '.roo_cli_history');

class RooCLI {
    constructor(options = {}) {
        this.host = options.host || DEFAULT_HOST;
        this.port = options.port || DEFAULT_PORT;
        
        // State
        this.connected = false;
        this.rooConnected = false;
        this.currentTask = null;
        this.socket = null;
        this.rl = null;
        this.buffer = '';
        
        this.setupReadline();
        this.connectToDaemon();
    }

    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt(),
            historySize: 1000
        });

        // Load command history
        this.loadHistory();

        // Handle input
        this.rl.on('line', (input) => {
            this.handleInput(input.trim());
        });

        // Handle Ctrl+C
        this.rl.on('SIGINT', () => {
            this.log('\n👋 Goodbye!', 'info');
            this.shutdown();
        });

        // Save history on exit
        this.rl.on('close', () => {
            this.saveHistory();
        });

        // Tab completion
        this.rl.on('completer', this.completer.bind(this));
    }

    completer(line) {
        const commands = [
            '/help', '/status', '/quit', '/clear', '/history',
            'create a', 'write a', 'fix the', 'update the', 'add a',
            'implement', 'refactor', 'debug', 'test', 'deploy'
        ];
        
        const hits = commands.filter((c) => c.startsWith(line));
        return [hits.length ? hits : commands, line];
    }

    loadHistory() {
        try {
            if (existsSync(HISTORY_FILE)) {
                const history = readFileSync(HISTORY_FILE, 'utf8')
                    .split('\n')
                    .filter(line => line.trim())
                    .slice(-1000); // Keep last 1000 entries
                
                history.forEach(line => this.rl.history.unshift(line));
            }
        } catch (error) {
            // Ignore history loading errors
        }
    }

    saveHistory() {
        try {
            const history = this.rl.history.slice(0, 1000).reverse().join('\n');
            writeFileSync(HISTORY_FILE, history);
        } catch (error) {
            // Ignore history saving errors
        }
    }

    connectToDaemon() {
        this.log(`🔌 Connecting to Roo Daemon at ${this.host}:${this.port}...`, 'info');
        
        this.socket = net.createConnection(this.port, this.host);

        this.socket.on('connect', () => {
            this.connected = true;
            this.log('✅ Connected to Roo Daemon', 'success');
            this.updatePrompt();
        });

        this.socket.on('data', (data) => {
            this.handleDaemonMessage(data);
        });

        this.socket.on('close', () => {
            this.connected = false;
            this.rooConnected = false;
            this.log('❌ Disconnected from Roo Daemon', 'error');
            this.updatePrompt();
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.connected) {
                    this.log('🔄 Attempting to reconnect...', 'info');
                    this.connectToDaemon();
                }
            }, 3000);
        });

        this.socket.on('error', (err) => {
            this.log(`❌ Connection error: ${err.message}`, 'error');
            if (err.code === 'ECONNREFUSED') {
                this.log('💡 Make sure the Roo Daemon is running:', 'info');
                this.log(`   node roo-daemon.js --port ${this.port}`, 'info');
            }
        });
    }

    handleDaemonMessage(data) {
        this.buffer += data.toString();
        
        // Process complete JSON messages (one per line)
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    this.processDaemonMessage(message);
                } catch (error) {
                    this.log(`Invalid JSON from daemon: ${error.message}`, 'error');
                }
            }
        }
    }

    processDaemonMessage(message) {
        switch (message.type) {
            case 'welcome':
                this.rooConnected = message.data.connected && !!message.data.clientId;
                if (message.data.clientId) {
                    this.log(`🎉 Roo is ready! Client ID: ${message.data.clientId}`, 'success');
                } else if (message.data.connected) {
                    this.log(`🔄 Connected to daemon, waiting for Roo connection...`, 'warn');
                } else {
                    this.log(`⚠️ Daemon not connected to Roo`, 'warn');
                }
                this.updatePrompt();
                break;

            case 'status':
                this.rooConnected = message.data.connected;
                this.log(`📡 ${message.data.message}`, message.data.connected ? 'success' : 'warn');
                this.updatePrompt();
                break;

            case 'ready':
                this.rooConnected = true;
                this.log(`🚀 ${message.data.message}`, 'success');
                this.updatePrompt();
                break;

            case 'taskSent':
                this.log(`📤 Task sent: "${message.data.text}"`, 'success');
                break;

            case 'ipcMessage':
                this.handleRooMessage(message.data);
                break;

            case 'error':
                this.log(`❌ ${message.data.message}`, 'error');
                break;

            case 'pong':
                // Handle ping response if needed
                break;

            default:
                this.log(`Unknown daemon message: ${message.type}`, 'warn');
        }
    }

    handleRooMessage(data) {
        if (data.type === 'taskEvent' || data.type === 'TaskEvent') {
            // Handle both lowercase and uppercase variants
            const eventData = data.data || data;
            const { eventName, payload } = eventData;
            
            switch (eventName) {
                case 'taskStarted':
                    this.currentTask = payload[0];
                    this.log(`🏃 Task started: ${this.currentTask}`, 'info');
                    this.updatePrompt();
                    break;
                    
                case 'taskCompleted':
                    const [taskId, tokenUsage, toolUsage] = payload;
                    this.log(`✅ Task completed: ${taskId}`, 'success');
                    if (tokenUsage) {
                        this.log(`📊 Tokens used: ${JSON.stringify(tokenUsage)}`, 'info');
                    }
                    this.currentTask = null;
                    this.updatePrompt();
                    break;
                    
                case 'taskAborted':
                    this.log(`⚠️ Task aborted: ${payload[0]}`, 'warn');
                    this.currentTask = null;
                    this.updatePrompt();
                    break;
                    
                case 'message':
                    const messageData = payload[0];
                    if (messageData.message) {
                        if (messageData.message.type === 'say') {
                            this.log(`🤖 Roo: ${messageData.message.text || ''}`, 'roo');
                        } else if (messageData.message.type === 'ask') {
                            this.log(`❓ Roo asks: ${messageData.message.text || ''}`, 'roo');
                        } else {
                            this.log(`🔧 Roo (${messageData.message.type}): ${JSON.stringify(messageData.message, null, 2)}`, 'roo');
                        }
                    }
                    break;
                    
                default:
                    this.log(`📋 Task event: ${eventName}`, 'info');
            }
        } else {
            this.log(`📨 Received unknown message type: ${data.type}`, 'info');
        }
    }

    handleInput(input) {
        if (!input) {
            this.rl.prompt();
            return;
        }

        // Handle commands
        if (input.startsWith('/')) {
            this.handleCommand(input);
            return;
        }

        // Send task to Roo
        if (!this.connected) {
            this.log('❌ Not connected to daemon', 'error');
            this.rl.prompt();
            return;
        }

        if (!this.rooConnected) {
            this.log('❌ Roo is not connected', 'error');
            this.rl.prompt();
            return;
        }

        this.sendTask(input);
        this.rl.prompt();
    }

    handleCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        
        switch (cmd) {
            case 'help':
                this.showHelp();
                break;
                
            case 'status':
                this.showStatus();
                break;
                
            case 'quit':
            case 'exit':
                this.shutdown();
                break;
                
            case 'clear':
                console.clear();
                this.log('🧹 Screen cleared', 'info');
                break;
                
            case 'history':
                this.showHistory();
                break;
                
            case 'ping':
                this.pingDaemon();
                break;
                
            default:
                this.log(`❓ Unknown command: ${cmd}. Type /help for available commands.`, 'warn');
        }
        
        this.rl.prompt();
    }

    sendTask(text) {
        try {
            const message = {
                type: 'sendTask',
                data: { text: text }
            };
            
            this.socket.write(JSON.stringify(message) + '\n');
            this.log(`📝 Sending: "${text}"`, 'input');
        } catch (error) {
            this.log(`❌ Error sending task: ${error.message}`, 'error');
        }
    }

    pingDaemon() {
        if (this.connected) {
            const message = { type: 'ping', data: { timestamp: Date.now() } };
            this.socket.write(JSON.stringify(message) + '\n');
            this.log('🏓 Ping sent to daemon', 'info');
        } else {
            this.log('❌ Not connected to daemon', 'error');
        }
    }

    showHelp() {
        console.log(chalk.cyan(`
🤖 Roo CLI Help
===============

Commands:
  /help                Show this help message
  /status              Show connection status
  /clear               Clear the screen
  /history             Show command history
  /ping                Ping the daemon
  /quit, /exit         Exit the CLI

Usage:
  - Type any message to send it to Roo
  - Use arrow keys to navigate command history
  - Tab completion is available for common phrases
  - Ctrl+C to exit

Examples:
  create a simple web page
  fix the bug in the login function
  add tests for the user service
  refactor the database connection code

Status Indicators:
  🔴 Disconnected from daemon
  🟡 Connected to daemon, Roo not ready
  🟢 Connected and ready to send tasks
        `));
    }

    showStatus() {
        console.log(chalk.cyan('\n📊 Status Report'));
        console.log(chalk.cyan('================'));
        console.log(`Daemon Connection: ${this.connected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
        console.log(`Roo Connection: ${this.rooConnected ? chalk.green('✅ Ready') : chalk.red('❌ Not Ready')}`);
        console.log(`Current Task: ${this.currentTask ? chalk.yellow(this.currentTask) : chalk.gray('None')}`);
        console.log(`Server: ${this.host}:${this.port}`);
        console.log('');
    }

    showHistory() {
        console.log(chalk.cyan('\n📚 Command History (last 10)'));
        console.log(chalk.cyan('=============================='));
        const history = this.rl.history.slice(0, 10);
        history.forEach((cmd, i) => {
            console.log(`${chalk.gray((history.length - i).toString().padStart(2))}: ${cmd}`);
        });
        console.log('');
    }

    getPrompt() {
        if (!this.connected) {
            return chalk.red('🔴 roo> ');
        } else if (!this.rooConnected) {
            return chalk.yellow('🟡 roo> ');
        } else if (this.currentTask) {
            return chalk.blue('🔵 roo> ');
        } else {
            return chalk.green('🟢 roo> ');
        }
    }

    updatePrompt() {
        this.rl.setPrompt(this.getPrompt());
    }

    log(message, level = 'info') {
        // Clear current line and move cursor up
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        
        const timestamp = new Date().toLocaleTimeString();
        let coloredMessage;
        
        switch (level) {
            case 'error':
                coloredMessage = chalk.red(message);
                break;
            case 'warn':
                coloredMessage = chalk.yellow(message);
                break;
            case 'success':
                coloredMessage = chalk.green(message);
                break;
            case 'roo':
                coloredMessage = chalk.magenta(message);
                break;
            case 'input':
                coloredMessage = chalk.cyan(message);
                break;
            default:
                coloredMessage = chalk.white(message);
        }
        
        console.log(`${chalk.gray(timestamp)} ${coloredMessage}`);
        this.rl.prompt();
    }

    shutdown() {
        this.saveHistory();
        
        if (this.socket) {
            this.socket.end();
        }
        
        if (this.rl) {
            this.rl.close();
        }
        
        process.exit(0);
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
            case '--help':
                console.log(`
Roo CLI - Interactive Command Line Interface

Usage: node roo-cli.js [options]

Options:
  --port <port>        TCP port to connect to (default: 7777)
  --host <host>        TCP host to connect to (default: localhost)
  --help               Show this help message

Example:
  node roo-cli.js --port 7777 --host localhost
                `);
                process.exit(0);
                break;
        }
    }
    
    return options;
}

// Start the CLI
console.log(chalk.blue.bold('🚀 Starting Roo CLI...'));
const options = parseArgs();
new RooCLI(options);