import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { API } from '../extension/api';
import { ClineProvider } from '../core/webview/ClineProvider';
import { IpcServer } from '@roo-code/ipc';
import { IpcMessageType, TaskEvent, RooCodeEventName } from '@roo-code/types';
import { TelemetryService } from '@roo-code/telemetry';

const testSocketPath = path.join(os.tmpdir(), `roo-test-ipc-${Date.now()}.sock`);

// Mock vscode and other dependencies
vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn((key: string) => {
                if (key === 'api.provider') {
                    return 'test-provider';
                }
                return undefined;
            }),
            update: vi.fn(),
        }),
        createFileSystemWatcher: vi.fn(() => ({
            onDidCreate: vi.fn(),
            onDidChange: vi.fn(),
            onDidDelete: vi.fn(),
            dispose: vi.fn(),
        })),
    },
    commands: {
        executeCommand: vi.fn(),
    },
    Uri: {
        file: vi.fn(p => p),
    },
    RelativePattern: class {
        constructor() {
            // mock constructor
        }
    },
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            show: vi.fn(),
            clear: vi.fn(),
            dispose: vi.fn(),
            name: 'mock',
            append: vi.fn(),
            hide: vi.fn(),
        })),
        createTextEditorDecorationType: vi.fn(() => ({
            key: 'mock-decoration',
            dispose: vi.fn(),
        })),
        tabGroups: {
            all: [],
        }
    },
    env: {
        language: 'en'
    }
}));

describe('IPC Integration Test', () => {
    let api: API;
    let server: IpcServer;

    beforeAll(() => {
        // Clean up old socket if it exists
        if (fs.existsSync(testSocketPath)) {
            fs.unlinkSync(testSocketPath);
        }

        if (!TelemetryService.hasInstance()) {
            TelemetryService.createInstance();
        }

        const mockProviderState = {
            apiConfiguration: {
                apiProvider: 'bedrock',
                apiModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
            }
        };

        const mockProvider = {
            context: {
                extensionUri: 'file:///mock/path',
                globalStorageUri: {
                    fsPath: '/mock/global/storage/path'
                }
            },
            on: vi.fn(),
            getTask: vi.fn(),
            setValues: vi.fn().mockImplementation((values) => {
                Object.assign(mockProviderState, values);
                return Promise.resolve();
            }),
            getState: vi.fn().mockImplementation(() => Promise.resolve(mockProviderState)),
            postStateToWebview: vi.fn(),
            addClineToStack: vi.fn(),
        } as unknown as ClineProvider;

        api = new API(
            vi.mocked(vscode.window.createOutputChannel('Roo')),
            mockProvider,
            testSocketPath,
            true // enable logging to console for debugging
        );
        api.init();
        server = (api as any).ipc;
        console.log('[test] Server initialized.');
    });

    afterAll(() => {
        console.log('[test] Closing server.');
        (server as any)._server?.close();
        if (fs.existsSync(testSocketPath)) {
            fs.unlinkSync(testSocketPath);
        }
        console.log('[test] Server closed and socket unlinked.');
    });

    it('should establish a connection, start a task, and receive events', async () => {
        console.log('[test] Starting test...');
        let clientProcess: ChildProcess | null = null;
        let clientOutput = '';

        try {
            // Give the server a moment to start listening
            console.log('[test] Waiting for server to be ready...');
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log('[test] Server should be ready. Forking client.');

            clientProcess = spawn(
                'node',
                [
                    path.resolve(process.cwd(), '../roo-blessed/index.js')
                ],
                {
                    stdio: 'pipe',
                    env: { ...process.env, ROO_CODE_IPC_SOCKET_PATH: testSocketPath }
                }
            );

            clientProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                console.log('[client-stdout]', output.trimEnd());
                clientOutput += output;
            });
            clientProcess.stderr?.on('data', (data) => {
                console.error('[client-stderr]', data.toString().trimEnd());
            });
            clientProcess.on('exit', (code) => {
                console.log(`[test] Client process exited with code ${code}`);
            });

            console.log('[test] Setting up taskStartedPromise...');
            const taskStartedPromise = new Promise<string>((resolve, reject) => {
                api.on(RooCodeEventName.TaskStarted, (taskId) => {
                    console.log(`[test] api.on(TaskStarted) fired with taskId: ${taskId}`);
                    resolve(taskId);
                });
            });

            console.log('[test] Setting up clientReceivedEventPromise...');
            const clientReceivedEventPromise = new Promise<void>((resolve) => {
                const listener = (data: Buffer) => {
                    if (data.toString().includes('taskStarted')) {
                        console.log('[test] clientReceivedEventPromise resolved: client received taskStarted event.');
                        clientProcess?.stdout?.removeListener('data', listener);
                        resolve();
                    }
                };
                if (clientProcess) {
                    clientProcess.stdout?.on('data', listener);
                }
            });

            console.log('[test] Awaiting taskStartedPromise...');
            const taskId = await taskStartedPromise;
            console.log(`[test] taskStartedPromise resolved with taskId: ${taskId}`);
            expect(taskId).toBeTypeOf('string');

            console.log('[test] Awaiting clientReceivedEventPromise...');
            await clientReceivedEventPromise;
            console.log('[test] clientReceivedEventPromise resolved.');

            // Check client output to ensure it received the messages
            expect(clientOutput).toContain('[client#connect] Connected to Roo Code server.');
            expect(clientOutput).toContain('[client#connect] Sending registration command');
            expect(clientOutput).toContain('[client#message] Received message from server:');
            expect(clientOutput).toContain('"type": "Ack"');
            expect(clientOutput).toContain('"eventName": "taskStarted"');

            console.log('[test] All assertions passed.');

        } finally {
            console.log('--- [TEST] FINAL CLIENT OUTPUT ---');
            console.log(clientOutput);
            console.log('--- [TEST] END FINAL CLIENT OUTPUT ---');
            if (clientProcess) {
                console.log('[test] Killing client process.');
                clientProcess.kill();
            }
        }
    }, 20000); // 20s timeout for this integration test
});