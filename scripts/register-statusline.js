#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — register/unregister the statusline
 * in <config dir>/settings.json (cross-platform, no jq).
 *   node register-statusline.js on  "<plugin root | path to badge.js>"
 *   node register-statusline.js off
 * 'on' installs a version-robust launcher to a STABLE path
 * (<config dir>/claude-pulse/statusline.js) and registers THAT, so the
 * settings entry never hardcodes a versioned plugin directory — it
 * survives version bumps and reinstalls.
 * Safety: refuses to touch an unparseable settings.json, creates a
 * one-time settings.json.bak, and saves any foreign statusLine so
 * 'off' can restore it instead of leaving the user with none.
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// Honor CLAUDE_CONFIG_DIR (multi-profile setups); default ~/.claude.
const BASE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SETTINGS = path.join(BASE, 'settings.json');
const STABLE_DIR = path.join(BASE, 'claude-pulse');
const STABLE_LAUNCHER = path.join(STABLE_DIR, 'statusline.js');
const PREV_FILE = path.join(STABLE_DIR, 'previous-statusline.json');
const mode = process.argv[2];
const arg = process.argv[3];

// Missing file → fresh {}. Unparseable file → ABORT: writing back would
// replace the user's whole settings.json (permissions, hooks, env, …) with
// just our entry.
function load() {
  let text;
  try { text = fs.readFileSync(SETTINGS, 'utf8'); } catch { return {}; }
  try { return JSON.parse(text) || {}; } catch {
    console.error('error: ' + SETTINGS + ' is not valid JSON — refusing to rewrite it.');
    console.error('Fix the file manually, then re-run this step.');
    process.exit(1);
  }
}
// Only what this plugin itself registers counts as ours — never a user's own
// script that merely happens to be called statusline.js or badge.js.
function isOurs(sl) {
  const c = (sl && (typeof sl === 'string' ? sl : sl.command)) || '';
  return /claude-pulse/.test(c);
}
// Accept either a plugin root or a .../statusline/badge.js path.
function pluginRoot(p) {
  if (!p) return '';
  return /badge\.js$/.test(p) ? path.resolve(p, '..', '..') : p;
}

const settings = load();
// One-time backup of the pre-claude-pulse original. Never overwritten on
// later runs — by then settings.json already contains our own entry.
if (fs.existsSync(SETTINGS) && !fs.existsSync(SETTINGS + '.bak')) {
  try { fs.copyFileSync(SETTINGS, SETTINGS + '.bak'); } catch { /* ignore */ }
}

if (mode === 'on') {
  const root = pluginRoot(arg);
  if (!root) { console.error('on: missing plugin root'); process.exit(1); }
  fs.mkdirSync(STABLE_DIR, { recursive: true });
  const src = path.join(root, 'scripts', 'statusline-launcher.js');
  if (fs.existsSync(src)) fs.copyFileSync(src, STABLE_LAUNCHER);
  if (!fs.existsSync(STABLE_LAUNCHER)) {
    console.error('on: launcher not found at ' + src);
    process.exit(1);
  }
  // Stash a foreign statusline so 'off' can restore it later.
  if (settings.statusLine && !isOurs(settings.statusLine)) {
    try { fs.writeFileSync(PREV_FILE, JSON.stringify(settings.statusLine, null, 2) + '\n'); } catch { /* ignore */ }
  }
  settings.statusLine = { type: 'command', command: `node "${STABLE_LAUNCHER}"`, padding: 0 };
} else if (mode === 'off') {
  if (isOurs(settings.statusLine)) {
    let prev = null;
    try { prev = JSON.parse(fs.readFileSync(PREV_FILE, 'utf8')); } catch { /* none saved */ }
    if (prev) {
      settings.statusLine = prev;
      try { fs.rmSync(PREV_FILE, { force: true }); } catch { /* ignore */ }
    } else {
      delete settings.statusLine;
    }
  }
} else {
  console.error('usage: register-statusline.js on <pluginRoot> | off');
  process.exit(1);
}

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(mode === 'on'
  ? 'statusLine registered'
  : 'statusLine removed (previous statusline restored if one was saved)');
