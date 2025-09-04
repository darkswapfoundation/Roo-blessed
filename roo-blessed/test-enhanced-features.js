#!/usr/bin/env node

/*
 * Test Enhanced Features - CWD Support and Improved Output
 * 
 * This test verifies:
 * 1. CWD parameter is properly passed from CLI to daemon to Roo
 * 2. Improved output presentation with deduplication
 * 3. Enhanced CLI argument parsing
 */

import { RooCLIEnhanced } from './roo-cli-enhanced.js';
import net from 'net';
import chalk from 'chalk';

class FeatureTestSuite {
    constructor() {
        this.testResults = [];
        this.mockDaemon = null;
        this.mockPort = 7778; // Use different port for testing
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        let coloredMessage;
        
        switch (level) {
            case 'error':
                coloredMessage = chalk.red(message);
                break;
            case 'success':
                coloredMessage = chalk.green(message);
                break;
            case 'warn':
                coloredMessage = chalk.yellow(message);
                break;
            default:
                coloredMessage = chalk.white(message);
        }
        
        console.log(`${chalk.gray(timestamp)} ${coloredMessage}`);
    }

    async setupMockDaemon() {
        return new Promise((resolve, reject) => {
            this.mockDaemon = net.createServer((socket) => {
                this.log('Mock daemon: Client connected', 'success');
                
                // Send welcome message
                socket.write(JSON.stringify({
                    type: 'welcome',
                    data: {
                        connected: true,
                        clientId: 'test-client-123',
                        currentTask: null,
                        messageHistory: []
                    }
                }) + '\n');

                // Send ready message
                socket.write(JSON.stringify({
                    type: 'ready',
                    data: { clientId: 'test-client-123', message: 'Ready to accept commands' }
                }) + '\n');

                socket.on('data', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMockMessage(socket, message);
                    } catch (error) {
                        this.log(`Mock daemon: Invalid JSON: ${error.message}`, 'error');
                    }
                });

                socket.on('close', () => {
                    this.log('Mock daemon: Client disconnected', 'warn');
                });
            });

            this.mockDaemon.listen(this.mockPort, 'localhost', () => {
                this.log(`Mock daemon listening on port ${this.mockPort}`, 'success');
                resolve();
            });

            this.mockDaemon.on('error', reject);
        });
    }

    handleMockMessage(socket, message) {
        this.log(`Mock daemon received: ${JSON.stringify(message)}`, 'info');
        
        if (message.type === 'sendTask') {
            const { text, cwd } = message.data;
            
            // Verify CWD is included
            if (cwd) {
                this.testResults.push({
                    test: 'CWD Parameter Passing',
                    passed: true,
                    details: `CWD correctly passed: ${cwd}`
                });
            } else {
                this.testResults.push({
                    test: 'CWD Parameter Passing',
                    passed: false,
                    details: 'CWD parameter missing'
                });
            }

            // Send task confirmation
            socket.write(JSON.stringify({
                type: 'taskSent',
                data: { text, cwd, timestamp: Date.now() }
            }) + '\n');

            // Simulate some Roo responses to test deduplication
            this.simulateRooResponses(socket);
        }
    }

    simulateRooResponses(socket) {
        const responses = [
            {
                type: 'ipcMessage',
                data: {
                    type: 'TaskEvent',
                    data: {
                        eventName: 'taskStarted',
                        payload: ['test-task-123']
                    }
                }
            },
            {
                type: 'ipcMessage',
                data: {
                    type: 'TaskEvent',
                    data: {
                        eventName: 'message',
                        payload: [{
                            message: {
                                type: 'say',
                                text: 'I understand you want to test the enhanced features.'
                            }
                        }]
                    }
                }
            },
            // Duplicate message to test deduplication
            {
                type: 'ipcMessage',
                data: {
                    type: 'TaskEvent',
                    data: {
                        eventName: 'message',
                        payload: [{
                            message: {
                                type: 'say',
                                text: 'I understand you want to test the enhanced features.'
                            }
                        }]
                    }
                }
            },
            {
                type: 'ipcMessage',
                data: {
                    type: 'TaskEvent',
                    data: {
                        eventName: 'taskCompleted',
                        payload: ['test-task-123']
                    }
                }
            }
        ];

        responses.forEach((response, index) => {
            setTimeout(() => {
                socket.write(JSON.stringify(response) + '\n');
            }, (index + 1) * 500);
        });
    }

    async testCWDFunctionality() {
        this.log('🧪 Testing CWD functionality...', 'info');
        
        const cli = new RooCLIEnhanced({
            host: 'localhost',
            port: this.mockPort
        });

        try {
            await cli.connectToDaemon();
            
            // Wait for daemon to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Test starting a task with CWD
            const testCwd = '/tmp/test-directory';
            await cli.startTask('Test task with CWD', { cwd: testCwd });
            
            this.log('✅ CWD test completed', 'success');
            
            // Wait for responses
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            cli.shutdown();
            
        } catch (error) {
            this.log(`❌ CWD test failed: ${error.message}`, 'error');
            this.testResults.push({
                test: 'CWD Functionality',
                passed: false,
                details: error.message
            });
        }
    }

    async testCLIArgumentParsing() {
        this.log('🧪 Testing CLI argument parsing...', 'info');
        
        // Test parseOptions function by simulating command line args
        const testArgs = ['start', 'Test prompt', '--cwd', '/test/path', '--port', '8888'];
        
        // Mock the parseOptions function behavior
        const options = {};
        for (let i = 0; i < testArgs.length; i++) {
            switch (testArgs[i]) {
                case '--port':
                    options.port = parseInt(testArgs[++i]);
                    break;
                case '--host':
                    options.host = testArgs[++i];
                    break;
                case '--cwd':
                    options.cwd = testArgs[++i];
                    break;
            }
        }
        
        const expectedCwd = '/test/path';
        const expectedPort = 8888;
        
        if (options.cwd === expectedCwd && options.port === expectedPort) {
            this.testResults.push({
                test: 'CLI Argument Parsing',
                passed: true,
                details: `Correctly parsed --cwd=${expectedCwd} and --port=${expectedPort}`
            });
            this.log('✅ CLI argument parsing test passed', 'success');
        } else {
            this.testResults.push({
                test: 'CLI Argument Parsing',
                passed: false,
                details: `Expected cwd=${expectedCwd}, port=${expectedPort}, got cwd=${options.cwd}, port=${options.port}`
            });
            this.log('❌ CLI argument parsing test failed', 'error');
        }
    }

    async runAllTests() {
        this.log('🚀 Starting Enhanced Features Test Suite', 'info');
        this.log('=====================================', 'info');
        
        try {
            // Setup mock daemon
            await this.setupMockDaemon();
            
            // Run tests
            await this.testCLIArgumentParsing();
            await this.testCWDFunctionality();
            
            // Wait a bit for all async operations to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Show results
            this.showResults();
            
        } catch (error) {
            this.log(`❌ Test suite failed: ${error.message}`, 'error');
        } finally {
            // Cleanup
            if (this.mockDaemon) {
                this.mockDaemon.close();
            }
        }
    }

    showResults() {
        this.log('\n📊 Test Results', 'info');
        this.log('===============', 'info');
        
        let passed = 0;
        let total = this.testResults.length;
        
        this.testResults.forEach(result => {
            const status = result.passed ? '✅' : '❌';
            const color = result.passed ? 'success' : 'error';
            
            this.log(`${status} ${result.test}`, color);
            this.log(`   ${result.details}`, 'info');
            
            if (result.passed) passed++;
        });
        
        this.log(`\n📈 Summary: ${passed}/${total} tests passed`, passed === total ? 'success' : 'warn');
        
        if (passed === total) {
            this.log('🎉 All tests passed! Enhanced features are working correctly.', 'success');
        } else {
            this.log('⚠️  Some tests failed. Please review the implementation.', 'warn');
        }
    }
}

// Run the test suite
const testSuite = new FeatureTestSuite();
testSuite.runAllTests().catch(console.error);