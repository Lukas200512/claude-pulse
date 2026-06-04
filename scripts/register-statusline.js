#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — register/unregister the statusline
 * in ~/.claude/settings.json (cross-platform, no jq).
 *   node register-statusline.js on  "<abs path to badge.js>"
 *   node register-statusline.js off
 * Backs up settings.json to settings.json.bak before writing.
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const mode = process.argv[2];
const badge = process.argv[3];

function load() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { return {}; }
}
function isOurs(sl) {
  const c = sl && (typeof sl === 'string' ? sl : sl.command) || '';
  return /claude-pulse|badge\.js/.test(c);
}

const settings = load();
if (fs.existsSync(SETTINGS)) {
  try { fs.copyFileSync(SETTINGS, SETTINGS + '.bak'); } catch { /* ignore */ }
}

if (mode === 'on') {
  if (!badge) { console.error('on: missing badge path'); process.exit(1); }
  settings.statusLine = { type: 'command', command: `node "${badge}"`, padding: 0 };
} else if (mode === 'off') {
  if (isOurs(settings.statusLine)) delete settings.statusLine;
} else {
  console.error('usage: register-statusline.js on <badgePath> | off');
  process.exit(1);
}

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(mode === 'on' ? 'statusLine registered' : 'statusLine removed (if it was ours)');
