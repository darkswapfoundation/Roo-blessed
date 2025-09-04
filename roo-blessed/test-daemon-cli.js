#!/usr/bin/env node

/*
 * Test script for daemon/CLI communication
 * Tests the TCP communication between daemon and CLI without requiring Roo IPC
 */

import { spawn } from 'child_process';
import net from 'net';
import chalk from 'chalk';

const TEST_PORT = 7778; // Use different port for testing
const TEST_HOST = 'localhost';

class DaemonCLITester {
    constructor() {
        this.daemon = null;
        this.testClient = null;
        this.testsPassed = 0;
        this.testsTotal = 0;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? chalk.red('[ERROR]') : 
                      level === 'success' ? chalk.green('[SUCCESS]') :
                      level === 'test' ? chalk.cyan('[TEST]') :
                      chalk.blue('[INFO]');
        
        console.log(`${chalk.gray(timestamp)} ${prefix} ${message}`);
    }

    async runTests() {
        this.log('🧪 Starting Daemon/CLI Communication Tests', 'test');
        
        try {
            await this.startDaemon();
            await this.sleep(2000); // Wait for daemon to start
            await this.testTCPConnection();
            await this.testMessageProtocol();
            await this.testMultipleClients();
            
            this.log(`✅ Tests completed: ${this.testsPassed}/${this.testsTotal} passed`, 'success');
            
            if (this.testsPassed === this.testsTotal) {
                this.log('🎉 All tests passed! Daemon/CLI communication is working correctly.', 'success');
            } else {
                this.log('❌ Some tests failed. Check the output above.', 'error');
            }
            
        } catch (error) {
            this.log(`❌ Test suite failed: ${error.message}`, 'error');
        } finally {
            await this.cleanup();
        }
    }

    async startDaemon() {
        this.log('🚀 Starting test daemon...', 'test');
        
        return new Promise((resolve, reject) => {
            this.daemon = spawn('node', ['roo-daemon.js', '--port', TEST_PORT, '--host', TEST_HOST], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            this.daemon.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('TCP server listening')) {
                    this.log('✅ Daemon started successfully', 'success');
                    resolve();
                }
            });

            this.daemon.stderr.on('data', (data) => {
                this.log(`Daemon stderr: ${data.toString()}`, 'error');
            });

            this.daemon.on('error', (error) => {
                reject(new Error(`Failed to start daemon: ${error.message}`));
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                reject(new Error('Daemon startup timeout'));
            }, 10000);
        });
    }

    async testTCPConnection() {
        this.testsTotal++;
        this.log('🔌 Testing TCP connection...', 'test');
        
        return new Promise((resolve, reject) => {
            const client = net.createConnection(TEST_PORT, TEST_HOST);
            
            client.on('connect', () => {
                this.log('✅ TCP connection successful', 'success');
                this.testsPassed++;
                client.end();
                resolve();
            });

            client.on('error', (error) => {
                this.log(`❌ TCP connection failed: ${error.message}`, 'error');
                reject(error);
            });

            setTimeout(() => {
                client.destroy();
                reject(new Error('TCP connection timeout'));
            }, 5000);
        });
    }

    async testMessageProtocol() {
        this.testsTotal++;
        this.log('📨 Testing message protocol...', 'test');
        
        return new Promise((resolve, reject) => {
            const client = net.createConnection(TEST_PORT, TEST_HOST);
            let receivedWelcome = false;
            
            client.on('connect', () => {
                this.log('Connected to daemon for protocol test', 'info');
            });

            client.on('data', (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    try {
                        const message = JSON.parse(line);
                        
                        if (message.type === 'welcome') {
                            this.log('✅ Received welcome message', 'success');
                            receivedWelcome = true;
                            
                            // Send a ping message
                            const ping = { type: 'ping', data: { timestamp: Date.now() } };
                            client.write(JSON.stringify(ping) + '\n');
                        } else if (message.type === 'pong') {
                            this.log('✅ Received pong response', 'success');
                            this.testsPassed++;
                            client.end();
                            resolve();
                        }
                    } catch (error) {
                        this.log(`❌ Invalid JSON received: ${error.message}`, 'error');
                    }
                }
            });

            client.on('error', (error) => {
                this.log(`❌ Protocol test failed: ${error.message}`, 'error');
                reject(error);
            });

            setTimeout(() => {
                if (!receivedWelcome) {
                    client.destroy();
                    reject(new Error('Did not receive welcome message'));
                }
            }, 5000);
        });
    }

    async testMultipleClients() {
        this.testsTotal++;
        this.log('👥 Testing multiple client connections...', 'test');
        
        return new Promise((resolve, reject) => {
            let connectedClients = 0;
            const clients = [];
            const targetClients = 3;
            
            for (let i = 0; i < targetClients; i++) {
                const client = net.createConnection(TEST_PORT, TEST_HOST);
                clients.push(client);
                
                client.on('connect', () => {
                    connectedClients++;
                    this.log(`Client ${i + 1} connected`, 'info');
                    
                    if (connectedClients === targetClients) {
                        this.log('✅ Multiple clients connected successfully', 'success');
                        this.testsPassed++;
                        
                        // Close all clients
                        clients.forEach(c => c.end());
                        resolve();
                    }
                });

                client.on('error', (error) => {
                    this.log(`❌ Client ${i + 1} error: ${error.message}`, 'error');
                    reject(error);
                });
            }

            setTimeout(() => {
                clients.forEach(c => c.destroy());
                reject(new Error('Multiple client test timeout'));
            }, 5000);
        });
    }

    async cleanup() {
        this.log('🧹 Cleaning up...', 'test');
        
        if (this.daemon) {
            this.daemon.kill('SIGTERM');
            
            // Wait for daemon to exit
            await new Promise((resolve) => {
                this.daemon.on('exit', () => {
                    this.log('✅ Daemon stopped', 'success');
                    resolve();
                });
                
                setTimeout(() => {
                    this.daemon.kill('SIGKILL');
                    resolve();
                }, 3000);
            });
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run tests
console.log(chalk.blue.bold('🧪 Roo Daemon/CLI Communication Test Suite'));
console.log('===========================================\n');

const tester = new DaemonCLITester();
tester.runTests().catch(console.error);