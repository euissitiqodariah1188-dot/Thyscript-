#!/usr/bin/env node
'use strict';

/**
 * thys - ThyScript Universal CLI & Control Panel Launcher
 * Usage:
 *   thys panel                Launch the Live Web Control Panel
 *   thys run <file.thy>       Run a ThyScript file
 *   thys compile <file.thy>   Compile to JavaScript
 *   thys check                Check environment & dependencies
 */

const path = require('path');

// Pass through to bin/thy.js
// If invoked with no args or 'panel' or 'control-panel', default to panel if intended or forward args
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === 'panel' || args[0] === 'control-panel') {
  // Directly forward with 'panel' if empty
  if (args.length === 0) {
    process.argv.push('panel');
  }
}

require(path.join(__dirname, 'thy.js'));
