#!/usr/bin/env node
/**
 * Cleanup Next.js worker processes after build
 *
 * Next.js 16 with Turbopack leaves orphaned worker processes.
 * This script kills all jest-worker/processChild processes.
 */

const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);

async function cleanupWorkers() {
  try {
    if (process.platform === 'win32') {
      // Windows - taskkill
      await execFileAsync('taskkill', [
        '/F',
        '/IM',
        'node.exe',
        '/FI',
        'WINDOWTITLE eq *processChild*'
      ], { stdio: 'ignore' });
    } else {
      // macOS/Linux - use pkill for safety
      await execFileAsync('pkill', ['-9', '-f', 'jest-worker/processChild'], {
        stdio: 'ignore'
      });
    }
    console.log('✓ Cleaned up orphaned worker processes');
  } catch (error) {
    // Ignore errors - processes may already be closed
    console.log('✓ Worker cleanup complete');
  }
}

cleanupWorkers();
