#!/usr/bin/env node
/* ============================================================
 * Claude Terminal Colors — environment doctor (read-only)
 * Cross-platform (Node). Prints "key: value" lines and a final
 * VERDICT about which indicator channels will work here.
 * ========================================================== */
'use strict';
const os = require('os');

const env = process.env;
const platform = os.platform(); // 'linux' | 'darwin' | 'win32'
const isWSL = platform === 'linux' && /microsoft|wsl/i.test(os.release());
const termProgram = env.TERM_PROGRAM || (env.WT_SESSION ? 'Windows Terminal' : '') || 'unknown';
const term = env.TERM || 'unset';
const mux = env.TMUX ? 'tmux' : (env.STY ? 'screen' : 'none');
const ssh = !!(env.SSH_CONNECTION || env.SSH_TTY);

// OSC 9 notification support is terminal-dependent. These are known-good.
const notifyOk = /Windows Terminal|iTerm|WezTerm|ConEmu|ghostty|Apple_Terminal|vscode/i.test(termProgram)
  || !!env.WT_SESSION || /wezterm|ghostty/i.test(term);

const os_label =
  platform === 'win32' ? 'Windows (native)' :
  platform === 'darwin' ? 'macOS' :
  isWSL ? 'Linux (WSL)' : 'Linux';

console.log('os: ' + os_label);
console.log('ssh: ' + (ssh ? 'yes' : 'no'));
console.log('terminal: ' + termProgram);
console.log('TERM: ' + term);
console.log('multiplexer: ' + mux);
console.log('node: ' + process.version);

console.log('');
console.log('Statusline badge: WORKS — Claude Code renders it; any OS/terminal.');
console.log('Window title:     WORKS — emitted via Claude Code; note Claude also sets its own title, so they may alternate.');
console.log('Notifications:    ' + (notifyOk
  ? 'LIKELY — your terminal is known to support OSC 9 notifications.'
  : 'MAYBE — OSC 9 notifications are terminal-dependent and may be ignored here; statusline + title still work.'));
if (mux === 'tmux') console.log('TIP: tmux passes terminalSequence through Claude Code, no extra config needed.');
console.log('');
console.log('VERDICT: OK — at least the statusline badge and title work in this environment.');
