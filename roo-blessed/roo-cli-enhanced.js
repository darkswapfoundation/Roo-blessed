#!/usr/bin/env node

/*
 * Roo CLI Enhanced - Advanced Command Line Interface
 * 
 * This CLI provides advanced session management for Roo tasks:
 * - roo-cli start "prompt" - Start a new task
 * - roo-cli ls - List active tasks
 * - roo-cli attach <taskId> - Attach to an active task
 * - roo-cli interactive - Interactive mode
 * 
 * Features:
 * - Session management and tracking
 * - Task attachment and monitoring
 * - Real-time task status updates
 * - Command history and persistence
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
const SESSIONS_FILE = join(homedir(), '.roo_sessions.json');

// Task Command Names (from Roo source)
const TaskCommandName = {
    StartNewTask: "StartNewTask",
    CancelTask: "CancelTask", 
    CloseTask: "CloseTask"
};

class RooSession {
    constructor(taskId, prompt, startTime = Date.now()) {
        this.taskId = taskId;
        this.prompt = prompt;
        this.startTime = startTime;
        this.status = 'active';
        this.lastActivity = startTime;
        this.messages = [];
    }

    addMessage(message) {
        this.messages.push({
            timestamp: Date.now(),
            content: message
        });
        this.lastActivity = Date.now();
    }

    updateStatus(status) {
        this.status = status;
        this.lastActivity = Date.now();
    }

    getAge() {
        return Date.now() - this.startTime;
    }

    getLastActivity() {
        return Date.now() - this.lastActivity;
    }
}

class RooSessionManager {
    constructor() {
        this.sessions = new Map();
        this.loadSessions();
    }

    loadSessions() {
        try {
            if (existsSync(SESSIONS_FILE)) {
                const data = JSON.parse(readFileSync(SESSIONS_FILE, 'utf8'));
                for (const [taskId, sessionData] of Object.entries(data)) {
                    const session = new RooSession(
                        sessionData.taskId,
                        sessionData.prompt,
                        sessionData.startTime
                    );
                    session.status = sessionData.status;
                    session.lastActivity = sessionData.lastActivity;
                    session.messages = sessionData.messages || [];
                    this.sessions.set(taskId, session);
                }
            }
        } catch (error) {
            console.error('Error loading sessions:', error.message);
        }
    }

    saveSessions() {
        try {
            const data = {};
            for (const [taskId, session] of this.sessions.entries()) {
                data[taskId] = {
                    taskId: session.taskId,
                    prompt: session.prompt,
                    startTime: session.startTime,
                    status: session.status,
                    lastActivity: session.lastActivity,
                    messages: session.messages
                };
            }
            writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving sessions:', error.message);
        }
    }

    createSession(taskId, prompt) {
        const session = new RooSession(taskId, prompt);
        this.sessions.set(taskId, session);
        this.saveSessions();
        return session;
    }

    getSession(taskId) {
        return this.sessions.get(taskId);
    }

    updateSession(taskId, updates) {
        const session = this.sessions.get(taskId);
        if (session) {
            Object.assign(session, updates);
            this.saveSessions();
        }
    }

    listActiveSessions() {
        return Array.from(this.sessions.values())
            .filter(session => session.status === 'active')
            .sort((a, b) => b.lastActivity - a.lastActivity);
    }

    listAllSessions() {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.lastActivity - a.lastActivity);
    }

    cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
        const now = Date.now();
        for (const [taskId, session] of this.sessions.entries()) {
            if (session.status === 'completed' && (now - session.lastActivity) > maxAge) {
                this.sessions.delete(taskId);
            }
        }
        this.saveSessions();
    }
}

class RooCLIEnhanced {
    constructor(options = {}) {
        this.host = options.host || DEFAULT_HOST;
        this.port = options.port || DEFAULT_PORT;
        this.mode = options.mode || 'command'; // 'command' or 'interactive'
        
        // State
        this.connected = false;
        this.rooConnected = false;
        this.currentTask = null;
        this.attachedTaskId = null;
        this.socket = null;
        this.rl = null;
        this.buffer = '';
        
        // Session management
        this.sessionManager = new RooSessionManager();
        
        // Clean up old sessions on startup
        this.sessionManager.cleanupOldSessions();
    }

    async connectToDaemon() {
        return new Promise((resolve, reject) => {
            this.socket = net.createConnection(this.port, this.host);

            this.socket.on('connect', () => {
                this.connected = true;
                resolve();
            });

            this.socket.on('data', (data) => {
                this.handleDaemonMessage(data);
            });

            this.socket.on('close', () => {
                this.connected = false;
                this.rooConnected = false;
            });

            this.socket.on('error', (err) => {
                reject(err);
            });
        });
    }

    handleDaemonMessage(data) {
        this.buffer += data.toString();
        
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    this.processDaemonMessage(message);
                } catch (error) {
                    // Ignore JSON parse errors
                }
            }
        }
    }

    processDaemonMessage(message) {
        switch (message.type) {
            case 'welcome':
                this.rooConnected = message.data.connected && !!message.data.clientId;
                break;

            case 'ready':
                this.rooConnected = true;
                break;

            case 'ipcMessage':
                this.handleRooMessage(message.data);
                break;
        }
    }

    handleRooMessage(data) {
        if (data.type === 'TaskEvent') {
            const { eventName, payload, taskId } = data.data;
            
            switch (eventName) {
                case 'taskStarted':
                    const startedTaskId = payload[0];
                    this.currentTask = startedTaskId;
                    
                    // Update session if we have one
                    const session = this.sessionManager.getSession(startedTaskId);
                    if (session) {
                        session.updateStatus('running');
                    }
                    
                    if (this.mode === 'interactive') {
                        this.log(`🏃 Task started: ${startedTaskId}`, 'success');
                    }
                    break;
                    
                case 'taskCompleted':
                    const [completedTaskId] = payload;
                    
                    // Update session
                    const completedSession = this.sessionManager.getSession(completedTaskId);
                    if (completedSession) {
                        completedSession.updateStatus('completed');
                    }
                    
                    if (this.mode === 'interactive') {
                        this.log(`✅ Task completed: ${completedTaskId}`, 'success');
                    }
                    
                    if (this.currentTask === completedTaskId) {
                        this.currentTask = null;
                    }
                    break;
                    
                case 'taskAborted':
                    const [abortedTaskId] = payload;
                    
                    // Update session
                    const abortedSession = this.sessionManager.getSession(abortedTaskId);
                    if (abortedSession) {
                        abortedSession.updateStatus('aborted');
                    }
                    
                    if (this.mode === 'interactive') {
                        this.log(`⚠️ Task aborted: ${abortedTaskId}`, 'warn');
                    }
                    
                    if (this.currentTask === abortedTaskId) {
                        this.currentTask = null;
                    }
                    break;
                    
                case 'message':
                    const messageData = payload[0];
                    if (messageData.message && this.mode === 'interactive') {
                        if (messageData.message.type === 'say') {
                            this.log(`🤖 Roo: ${messageData.message.text || ''}`, 'roo');
                        } else if (messageData.message.type === 'ask') {
                            this.log(`❓ Roo asks: ${messageData.message.text || ''}`, 'roo');
                        }
                    }
                    
                    // Add message to session
                    if (messageData.taskId) {
                        const session = this.sessionManager.getSession(messageData.taskId);
                        if (session) {
                            session.addMessage(messageData.message);
                        }
                    }
                    break;
            }
        }
    }

    async startTask(prompt, options = {}) {
        if (!this.connected) {
            throw new Error('Not connected to daemon');
        }

        if (!this.rooConnected) {
            throw new Error('Roo is not connected');
        }

        // Generate a temporary task ID for tracking
        const tempTaskId = `task-${Date.now()}`;
        
        // Create session
        const session = this.sessionManager.createSession(tempTaskId, prompt);

        const message = {
            type: 'sendTask',
            data: {
                text: prompt,
                cwd: options.cwd || process.cwd()
            }
        };
        
        this.socket.write(JSON.stringify(message) + '\n');
        
        return session;
    }

    async listSessions() {
        const activeSessions = this.sessionManager.listActiveSessions();
        const allSessions = this.sessionManager.listAllSessions();
        
        console.log(chalk.cyan('\n📋 Roo Sessions'));
        console.log(chalk.cyan('===============\n'));
        
        if (activeSessions.length === 0) {
            console.log(chalk.gray('No active sessions found.'));
        } else {
            console.log(chalk.green('Active Sessions:'));
            activeSessions.forEach((session, index) => {
                const age = this.formatDuration(session.getAge());
                const lastActivity = this.formatDuration(session.getLastActivity());
                const status = this.getStatusIcon(session.status);
                
                console.log(`${chalk.yellow((index + 1).toString().padStart(2))}. ${status} ${chalk.white(session.taskId)}`);
                console.log(`    ${chalk.gray('Prompt:')} ${session.prompt.substring(0, 60)}${session.prompt.length > 60 ? '...' : ''}`);
                console.log(`    ${chalk.gray('Age:')} ${age}, ${chalk.gray('Last activity:')} ${lastActivity} ago`);
                console.log('');
            });
        }
        
        const completedSessions = allSessions.filter(s => s.status !== 'active');
        if (completedSessions.length > 0) {
            console.log(chalk.gray('\nRecent Completed Sessions:'));
            completedSessions.slice(0, 5).forEach((session, index) => {
                const age = this.formatDuration(session.getAge());
                const status = this.getStatusIcon(session.status);
                
                console.log(`${chalk.gray((index + 1).toString().padStart(2))}. ${status} ${chalk.gray(session.taskId)}`);
                console.log(`    ${chalk.gray(session.prompt.substring(0, 60))}${session.prompt.length > 60 ? '...' : ''}`);
                console.log(`    ${chalk.gray('Completed:')} ${age} ago`);
            });
        }
        
        console.log('');
    }

    getStatusIcon(status) {
        switch (status) {
            case 'active':
            case 'running':
                return '🟢';
            case 'completed':
                return '✅';
            case 'aborted':
                return '❌';
            case 'paused':
                return '⏸️';
            default:
                return '⚪';
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    async attachToTask(taskId) {
        const session = this.sessionManager.getSession(taskId);
        if (!session) {
            throw new Error(`Task ${taskId} not found`);
        }

        this.attachedTaskId = taskId;
        this.mode = 'interactive';
        
        console.log(chalk.cyan(`\n🔗 Attached to task: ${taskId}`));
        console.log(chalk.gray(`Prompt: ${session.prompt}`));
        console.log(chalk.gray(`Status: ${session.status}`));
        console.log(chalk.gray(`Started: ${new Date(session.startTime).toLocaleString()}`));
        
        // Show recent messages
        if (session.messages.length > 0) {
            console.log(chalk.cyan('\nRecent messages:'));
            session.messages.slice(-5).forEach(msg => {
                const time = new Date(msg.timestamp).toLocaleTimeString();
                console.log(`${chalk.gray(time)} ${msg.content.text || JSON.stringify(msg.content)}`);
            });
        }
        
        console.log(chalk.yellow('\nPress Ctrl+C to detach, or type messages to continue the conversation.\n'));
        
        await this.startInteractiveMode();
    }

    async startInteractiveMode() {
        this.mode = 'interactive';
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.getPrompt()
        });

        this.rl.on('line', (input) => {
            this.handleInteractiveInput(input.trim());
        });

        this.rl.on('SIGINT', () => {
            console.log('\n👋 Detaching from session...');
            this.shutdown();
        });

        this.rl.prompt();
    }

    async handleInteractiveInput(input) {
        if (!input) {
            this.rl.prompt();
            return;
        }

        if (input.startsWith('/')) {
            await this.handleInteractiveCommand(input);
        } else {
            // Send message to current task or start new task
            try {
                if (this.attachedTaskId) {
                    // Continue existing conversation
                    await this.startTask(input);
                } else {
                    // Start new task
                    const session = await this.startTask(input);
                    this.attachedTaskId = session.taskId;
                    this.log(`🚀 Started new task: ${session.taskId}`, 'success');
                }
            } catch (error) {
                this.log(`❌ Error: ${error.message}`, 'error');
            }
        }
        
        this.rl.prompt();
    }

    async handleInteractiveCommand(command) {
        const [cmd, ...args] = command.slice(1).split(' ');
        
        switch (cmd) {
            case 'help':
                this.showInteractiveHelp();
                break;
            case 'ls':
                await this.listSessions();
                break;
            case 'attach':
                if (args[0]) {
                    try {
                        await this.attachToTask(args[0]);
                    } catch (error) {
                        this.log(`❌ ${error.message}`, 'error');
                    }
                } else {
                    this.log('❌ Usage: /attach <taskId>', 'error');
                }
                break;
            case 'detach':
                this.attachedTaskId = null;
                this.log('🔓 Detached from current task', 'info');
                break;
            case 'status':
                this.showStatus();
                break;
            case 'quit':
            case 'exit':
                this.shutdown();
                break;
            default:
                this.log(`❓ Unknown command: ${cmd}. Type /help for available commands.`, 'warn');
        }
    }

    showInteractiveHelp() {
        console.log(chalk.cyan(`
🤖 Roo CLI Interactive Mode Help
================================

Commands:
  /help                Show this help message
  /ls                  List all sessions
  /attach <taskId>     Attach to a specific task
  /detach              Detach from current task
  /status              Show connection status
  /quit, /exit         Exit interactive mode

Usage:
  - Type any message to send it to Roo (starts new task if not attached)
  - Use /attach to connect to existing tasks
  - Use /ls to see all available sessions
  - Ctrl+C to exit
        `));
    }

    getPrompt() {
        if (!this.connected) {
            return chalk.red('🔴 roo> ');
        } else if (!this.rooConnected) {
            return chalk.yellow('🟡 roo> ');
        } else if (this.attachedTaskId) {
            return chalk.blue(`🔵 roo[${this.attachedTaskId.slice(-8)}]> `);
        } else {
            return chalk.green('🟢 roo> ');
        }
    }

    showStatus() {
        console.log(chalk.cyan('\n📊 Status Report'));
        console.log(chalk.cyan('================'));
        console.log(`Daemon Connection: ${this.connected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
        console.log(`Roo Connection: ${this.rooConnected ? chalk.green('✅ Ready') : chalk.red('❌ Not Ready')}`);
        console.log(`Current Task: ${this.currentTask ? chalk.yellow(this.currentTask) : chalk.gray('None')}`);
        console.log(`Attached Task: ${this.attachedTaskId ? chalk.blue(this.attachedTaskId) : chalk.gray('None')}`);
        console.log(`Server: ${this.host}:${this.port}`);
        console.log(`Active Sessions: ${this.sessionManager.listActiveSessions().length}`);
        console.log('');
    }

    log(message, level = 'info') {
        if (this.rl) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
        
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
            default:
                coloredMessage = chalk.white(message);
        }
        
        console.log(`${chalk.gray(timestamp)} ${coloredMessage}`);
        
        if (this.rl) {
            this.rl.prompt();
        }
    }

    shutdown() {
        if (this.socket) {
            this.socket.end();
        }
        
        if (this.rl) {
            this.rl.close();
        }
        
        process.exit(0);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help') {
        showHelp();
        return;
    }

    const command = args[0];
    const { options, remainingArgs } = parseOptionsAndArgs(args.slice(1));
    
    const cli = new RooCLIEnhanced(options);
    
    try {
        await cli.connectToDaemon();
        
        // Wait a moment for daemon status
        await new Promise(resolve => setTimeout(resolve, 500));
        
        switch (command) {
            case 'start':
                if (remainingArgs.length === 0) {
                    console.error(chalk.red('❌ Usage: roo-cli start "your prompt here" [--cwd /path/to/directory]'));
                    process.exit(1);
                }
                const prompt = remainingArgs.join(' ');
                const taskOptions = {};
                if (options.cwd) {
                    taskOptions.cwd = options.cwd;
                }
                const session = await cli.startTask(prompt, taskOptions);
                console.log(chalk.green(`🚀 Started task: ${session.taskId}`));
                console.log(chalk.gray(`Prompt: ${prompt}`));
                if (options.cwd) {
                    console.log(chalk.gray(`Working Directory: ${options.cwd}`));
                }
                
                // Attach to the newly started task and enter interactive mode
                cli.attachedTaskId = session.taskId;
                console.log(chalk.blue('\n🔗 Entering interactive mode for this task...'));
                console.log(chalk.yellow('Type messages to continue the conversation, or use /help for commands.'));
                console.log(chalk.yellow('Press Ctrl+C to exit.\n'));
                
                await cli.startInteractiveMode();
                break;
                
            case 'ls':
            case 'list':
                await cli.listSessions();
                break;
                
            case 'attach':
                if (remainingArgs.length === 0) {
                    console.error(chalk.red('❌ Usage: roo-cli attach <taskId>'));
                    process.exit(1);
                }
                await cli.attachToTask(remainingArgs[0]);
                break;
                
            case 'interactive':
            case 'i':
                console.log(chalk.blue('🚀 Starting interactive mode...'));
                await cli.startInteractiveMode();
                break;
                
            default:
                console.error(chalk.red(`❌ Unknown command: ${command}`));
                showHelp();
                process.exit(1);
        }
        
    } catch (error) {
        console.error(chalk.red(`❌ Error: ${error.message}`));
        if (error.code === 'ECONNREFUSED') {
            console.error(chalk.yellow('💡 Make sure the Roo Daemon is running:'));
            console.error(chalk.yellow('   npm run daemon'));
        }
        process.exit(1);
    }
}

function parseOptionsAndArgs(args) {
    const options = {};
    const remainingArgs = [];
    
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--port':
                options.port = parseInt(args[++i]);
                break;
            case '--host':
                options.host = args[++i];
                break;
            case '--cwd':
                options.cwd = args[++i];
                break;
            default:
                // If it's not an option, add it to remaining args
                remainingArgs.push(args[i]);
                break;
        }
    }
    
    return { options, remainingArgs };
}

// Keep the old function for backward compatibility
function parseOptions(args) {
    return parseOptionsAndArgs(args).options;
}

function showHelp() {
    console.log(chalk.cyan(`
🤖 Roo CLI Enhanced - Advanced Session Management

Usage: roo-cli <command> [options]

Commands:
  start "prompt"       Start a new Roo task and enter interactive mode
  ls, list            List all sessions (active and completed)
  attach <taskId>     Attach to an active task session
  interactive, i      Start interactive mode without a task
  help                Show this help message

Options:
  --port <port>       TCP port to connect to (default: 7777)
  --host <host>       TCP host to connect to (default: localhost)
  --cwd <directory>   Working directory for the task (default: current directory)

Examples:
  roo-cli start "Create a web page"
  roo-cli start "Fix the bug in utils.js" --cwd /path/to/project
  roo-cli ls
  roo-cli attach task-1234567890
  roo-cli interactive

Interactive Mode:
  - Type messages to send to Roo
  - Use /ls to list sessions
  - Use /attach <taskId> to switch tasks
  - Use /help for interactive commands
  - Ctrl+C to exit
    `));
}

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { RooCLIEnhanced, RooSessionManager };