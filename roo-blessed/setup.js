#!/usr/bin/env node

/*
 * Setup script for Roo Blessed Client
 * Helps configure the IPC socket path and provides instructions
 */

import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

console.log('🚀 Roo Blessed Client Setup\n');

// Generate a socket path
const socketPath = join(tmpdir(), 'roo-code-ipc.sock');

console.log('📋 Setup Instructions:');
console.log('===================\n');

console.log('1. Set the IPC socket path environment variable:');
console.log(`   export ROO_CODE_IPC_SOCKET_PATH="${socketPath}"`);
console.log('');

console.log('2. Restart your VSCode/code-server instance with this environment variable:');
console.log(`   ROO_CODE_IPC_SOCKET_PATH="${socketPath}" code-server`);
console.log('   OR');
console.log(`   export ROO_CODE_IPC_SOCKET_PATH="${socketPath}"`);
console.log('   code-server');
console.log('');

console.log('3. Verify the Roo Code extension is loaded and IPC is enabled');
console.log('');

console.log('4. Test the connection:');
console.log('   npm test');
console.log('');

console.log('5. Start the Blessed client:');
console.log('   npm start');
console.log('');

// Create a shell script for convenience
const shellScript = `#!/bin/bash
# Roo Blessed Client Environment Setup

export ROO_CODE_IPC_SOCKET_PATH="${socketPath}"

echo "🔧 Environment configured:"
echo "   ROO_CODE_IPC_SOCKET_PATH=${socketPath}"
echo ""
echo "💡 Now restart your code-server with this environment variable set"
echo "   or run: source ./setup-env.sh && code-server"
echo ""
echo "🧪 Test connection: npm test"
echo "🚀 Start client: npm start"
`;

writeFileSync('./setup-env.sh', shellScript);
console.log('📄 Created setup-env.sh script for convenience');
console.log('   Run: source ./setup-env.sh');
console.log('');

// Create a .env file
const envContent = `# Roo Code IPC Socket Path
ROO_CODE_IPC_SOCKET_PATH=${socketPath}
`;

writeFileSync('./.env', envContent);
console.log('📄 Created .env file');
console.log('');

console.log('🔍 Current Status:');
if (process.env.ROO_CODE_IPC_SOCKET_PATH) {
    console.log(`   ✅ ROO_CODE_IPC_SOCKET_PATH is set: ${process.env.ROO_CODE_IPC_SOCKET_PATH}`);
    
    if (existsSync(process.env.ROO_CODE_IPC_SOCKET_PATH)) {
        console.log('   ✅ Socket file exists - ready to connect!');
    } else {
        console.log('   ⚠️  Socket file does not exist - restart code-server with the environment variable');
    }
} else {
    console.log('   ⚠️  ROO_CODE_IPC_SOCKET_PATH not set in current environment');
    console.log('   💡 Run: source ./setup-env.sh');
}

console.log('');
console.log('📚 For more information, see README.md');