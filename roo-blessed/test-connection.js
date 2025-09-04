#!/usr/bin/env node

/*
 * Test script to check IPC connection to Roo Code extension
 */

import { existsSync } from 'fs';
import { stat } from 'fs/promises';

async function testConnection() {
    console.log('🔍 Testing Roo Code IPC Connection...\n');

    // Check environment variable
    const socketPath = process.argv[2] || process.env.ROO_CODE_IPC_SOCKET_PATH;
    
    if (!socketPath) {
        console.log('❌ No socket path provided');
        console.log('   Set ROO_CODE_IPC_SOCKET_PATH environment variable or provide as argument');
        console.log('   Usage: node test-connection.js [socket_path]');
        return false;
    }

    console.log(`📍 Socket path: ${socketPath}`);

    // Check if socket file exists
    if (!existsSync(socketPath)) {
        console.log('❌ Socket file does not exist');
        console.log('   Make sure Roo Code extension is running with IPC enabled');
        console.log('   Set ROO_CODE_IPC_SOCKET_PATH environment variable in your VSCode/code-server instance');
        return false;
    }

    console.log('✅ Socket file exists');

    // Check socket file permissions
    try {
        const stats = await stat(socketPath);
        console.log(`📊 Socket file stats:`);
        console.log(`   Size: ${stats.size} bytes`);
        console.log(`   Modified: ${stats.mtime}`);
        console.log(`   Mode: ${stats.mode.toString(8)}`);
        
        if (stats.isSocket()) {
            console.log('✅ File is a valid socket');
        } else {
            console.log('❌ File exists but is not a socket');
            return false;
        }
    } catch (error) {
        console.log(`❌ Error checking socket file: ${error.message}`);
        return false;
    }

    console.log('\n🎉 Connection test passed!');
    console.log('   You can now run: npm start');
    return true;
}

// Run test
testConnection().catch(console.error);