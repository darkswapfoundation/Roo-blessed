#!/usr/bin/env node

/*
 * Test script for Roo Blessed UI without IPC connection
 * This helps test the UI components and key bindings independently
 */

import blessed from 'blessed';

class TestUI {
    constructor() {
        this.logs = [];
        this.messages = [];
        this.setupUI();
        this.log('🧪 Test UI started - testing key bindings and logging');
        this.log('💡 Type something and press Ctrl+Enter to test');
        this.log('📝 This should appear in the logs pane');
    }

    setupUI() {
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Roo Blessed Test UI',
            dockBorders: true,
            fullUnicode: true,
            autoPadding: true
        });

        // Status bar
        this.statusBox = blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            content: '{center}Roo Blessed Test UI - Testing Mode{/center}',
            tags: true,
            border: { type: 'line' },
            style: {
                fg: 'white',
                bg: 'blue',
                border: { fg: '#f0f0f0' }
            }
        });

        // Task box
        this.taskBox = blessed.box({
            top: 3,
            left: 0,
            width: '50%',
            height: '50%-3',
            content: 'Test Mode - No active task',
            tags: true,
            border: { type: 'line' },
            label: ' Current Task ',
            style: {
                fg: 'white',
                border: { fg: '#f0f0f0' }
            },
            scrollable: true,
            alwaysScroll: true
        });

        // Messages box
        this.messagesBox = blessed.box({
            top: 3,
            left: '50%',
            width: '50%',
            height: '50%-3',
            content: 'Test messages will appear here...',
            tags: true,
            border: { type: 'line' },
            label: ' Messages ',
            style: {
                fg: 'white',
                border: { fg: '#f0f0f0' }
            },
            scrollable: true,
            alwaysScroll: true
        });

        // Log box
        this.logBox = blessed.box({
            top: '50%',
            left: 0,
            width: '50%',
            height: '50%-3',
            content: '',
            tags: true,
            border: { type: 'line' },
            label: ' Logs ',
            style: {
                fg: 'white',
                border: { fg: '#f0f0f0' }
            },
            scrollable: true,
            alwaysScroll: true
        });

        // Input box
        this.inputBox = blessed.textarea({
            top: '50%',
            left: '50%',
            width: '50%',
            height: '50%-3',
            border: { type: 'line' },
            label: ' Test Input (Ctrl+Enter to test, Ctrl+C to quit) ',
            style: {
                fg: 'white',
                border: { fg: '#f0f0f0' }
            },
            inputOnFocus: true,
            scrollable: true,
            mouse: true
        });

        // Add components
        this.screen.append(this.statusBox);
        this.screen.append(this.taskBox);
        this.screen.append(this.messagesBox);
        this.screen.append(this.logBox);
        this.screen.append(this.inputBox);

        // Focus input
        this.inputBox.focus();

        // Key bindings
        this.screen.key(['escape', 'q', 'C-c'], () => {
            return process.exit(0);
        });

        // Test Ctrl+Enter binding
        this.inputBox.key(['C-enter', 'C-return'], () => {
            this.testSendMessage();
        });

        this.screen.key(['C-enter', 'C-return'], () => {
            if (this.inputBox.focused) {
                this.testSendMessage();
            }
        });

        // Help
        this.screen.key(['h', 'H'], () => {
            this.log('📖 Help: Type text and press Ctrl+Enter to test the UI');
        });

        this.screen.render();
    }

    testSendMessage() {
        const text = this.inputBox.getValue().trim();
        this.log(`🧪 testSendMessage() called with: "${text}"`);
        
        if (!text) {
            this.log('⚠️ No text to test - input is empty');
            return;
        }

        this.log(`✅ Ctrl+Enter binding works! Received: "${text}"`);
        this.addTestMessage(`Test message: ${text}`);
        this.updateTaskInfo(`Last test: ${text}`);
        
        // Clear input
        this.inputBox.clearValue();
        this.screen.render();
    }

    log(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logMessage = `[${timestamp}] ${message}`;
        
        this.logs.push(logMessage);
        
        if (this.logs.length > 100) {
            this.logs = this.logs.slice(-100);
        }
        
        this.logBox.setContent(this.logs.join('\n'));
        this.logBox.scrollTo(this.logBox.getScrollHeight());
        this.screen.render();
        
        console.log(logMessage);
    }

    addTestMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const content = `[${timestamp}] ${message}`;
        
        this.messages.push(content);
        
        if (this.messages.length > 100) {
            this.messages = this.messages.slice(-100);
        }
        
        this.messagesBox.setContent(this.messages.join('\n'));
        this.messagesBox.scrollTo(this.messagesBox.getScrollHeight());
        this.screen.render();
    }

    updateTaskInfo(info) {
        this.taskBox.setContent(info);
        this.taskBox.scrollTo(this.taskBox.getScrollHeight());
        this.screen.render();
    }
}

console.log('Starting Roo Blessed Test UI...');
const testUI = new TestUI();

process.on('SIGINT', () => {
    process.exit(0);
});

process.on('SIGTERM', () => {
    process.exit(0);
});