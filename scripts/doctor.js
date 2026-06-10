#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — doctor (read-only)
 * Cross-platform (Node). Checks BOTH the environment (which
 * indicator channels can work here) AND whether the plugin is
 * actually wired up: statusline registered, launcher resolvable,
 * config present, hooks firing. Prints findings and a VERDICT.
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const env = process.env;
const BASE = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const DIR = path.join(BASE, 'claude-pulse');
const SETTINGS = path.join(BASE, 'settings.json');
const PLUGINS = path.join(BASE, 'plugins');
const issues = [];

// ---- environment ---------------------------------------------
const platform = os.platform(); // 'linux' | 'darwin' | 'win32'
const isWSL = platform === 'linux' && /microsoft|wsl/i.test(os.release());
const termProgram = env.TERM_PROGRAM || (env.WT_SESSION ? 'Windows Terminal' : '') || 'unknown';
const term = env.TERM || 'unset';
const mux = env.TMUX ? 'tmux' : (env.STY ? 'screen' : 'none');
const ssh = !!(env.SSH_CONNECTION || env.SSH_TTY);
const truecolor = /truecolor|24bit/i.test(env.COLORTERM || '') || /-direct/.test(term);

// OSC 9 notification support is terminal-dependent. These are known-good.
// (Apple Terminal.app and plain VS Code do NOT implement OSC 9 — not listed.)
const notifyOk = /Windows Terminal|iTerm|WezTerm|ConEmu|ghostty/i.test(termProgram)
  || !!env.WT_SESSION || /wezterm|ghostty/i.test(term);

const os_label =
  platform === 'win32' ? 'Windows (native)' :
  platform === 'darwin' ? 'macOS' :
  isWSL ? 'Linux (WSL)' : 'Linux';

console.log('== environment ==');
console.log('os: ' + os_label);
console.log('ssh: ' + (ssh ? 'yes' : 'no'));
console.log('terminal: ' + termProgram);
console.log('TERM: ' + term);
console.log('multiplexer: ' + mux);
console.log('node: ' + process.version);
console.log('truecolor: ' + (truecolor ? 'yes (24-bit badge colors)' : 'not advertised (badge falls back to 256 colors)'));

// ---- plugin wiring -------------------------------------------
console.log('');
console.log('== plugin ==');
console.log('config dir: ' + BASE + (env.CLAUDE_CONFIG_DIR ? ' (from CLAUDE_CONFIG_DIR)' : ''));

// settings.json + statusline registration
let settings = null;
try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); }
catch (e) {
  if (fs.existsSync(SETTINGS)) {
    console.log('settings.json: UNPARSEABLE');
    issues.push('settings.json is not valid JSON — fix it before changing any settings.');
  } else {
    console.log('settings.json: missing');
  }
}
const slCmd = settings && settings.statusLine &&
  (typeof settings.statusLine === 'string' ? settings.statusLine : settings.statusLine.command) || '';
if (/claude-pulse/.test(slCmd)) {
  console.log('statusline: registered (claude-pulse)');
} else if (slCmd) {
  console.log('statusline: registered, but not claude-pulse: ' + slCmd);
  issues.push('Another statusline is registered. Run /claude-pulse:setup to switch (it saves yours and restores it on disable).');
} else {
  console.log('statusline: not registered');
  issues.push('No statusline registered — the badge cannot appear. Run /claude-pulse:setup.');
}

// stable launcher + badge resolution (same 3-step logic as the launcher)
const launcher = path.join(DIR, 'statusline.js');
console.log('launcher: ' + (fs.existsSync(launcher) ? launcher : 'missing (' + launcher + ')'));
function resolveBadge() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(PLUGINS, 'installed_plugins.json'), 'utf8'));
    const plugins = (j && j.plugins) || {};
    const key = Object.keys(plugins).find(k => k.split('@')[0] === 'claude-pulse');
    for (const e of (key ? plugins[key] : []) || []) {
      const p = e && e.installPath && path.join(e.installPath, 'statusline', 'badge.js');
      if (p && fs.existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  try {
    const base = path.join(PLUGINS, 'cache', 'claude-pulse', 'claude-pulse');
    // numeric semver order (lexicographic would put 2.9 above 2.10)
    const bySemverDesc = (a, b) => {
      const pa = a.split('.').map(n => parseInt(n, 10) || 0);
      const pb = b.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      return 0;
    };
    for (const v of fs.readdirSync(base).sort(bySemverDesc)) {
      const p = path.join(base, v, 'statusline', 'badge.js');
      if (fs.existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  const p = path.join(PLUGINS, 'marketplaces', 'claude-pulse', 'statusline', 'badge.js');
  return fs.existsSync(p) ? p : null;
}
const badge = resolveBadge();
console.log('badge.js: ' + (badge || 'NOT RESOLVED'));
if (/claude-pulse/.test(slCmd) && !badge) {
  issues.push('Statusline is registered but no installed badge.js was found — is the plugin still installed?');
}

// config / theme / hook activity
const cfg = path.join(DIR, 'config.conf');
console.log('config: ' + (fs.existsSync(cfg) ? cfg : '(none — defaults: everything on except title, badge wide)'));
const themeFile = path.join(DIR, 'theme.conf');
console.log('theme: ' + (fs.existsSync(themeFile) ? themeFile : '(built-in dark-minimal)'));
let lastEvent = null;
try {
  for (const f of fs.readdirSync(DIR)) {
    if (f !== 'state' && !f.startsWith('state-')) continue;
    const t = fs.statSync(path.join(DIR, f)).mtimeMs;
    if (lastEvent == null || t > lastEvent) lastEvent = t;
  }
} catch { /* no dir yet */ }
if (lastEvent != null) {
  const ago = Math.round((Date.now() - lastEvent) / 1000);
  console.log('hooks: firing (last event ' + (ago < 120 ? ago + 's' : Math.round(ago / 60) + 'm') + ' ago)');
} else {
  console.log('hooks: no state written yet');
  issues.push('Hooks have not written any state yet — if the plugin was just installed, restart Claude Code.');
}

// ---- channel notes -------------------------------------------
console.log('');
console.log('== channels ==');
console.log('Statusline badge: works on any OS/terminal — Claude Code renders it' +
  (/claude-pulse/.test(slCmd) ? '.' : ' (once registered).'));
console.log('Window title:     emitted via Claude Code; Claude also sets its own title, so they may alternate.');
console.log('Notifications:    ' + (notifyOk
  ? 'LIKELY — your terminal is known to support OSC 9 notifications.'
  : 'MAYBE — OSC 9 is terminal-dependent (works: Windows Terminal, iTerm2, WezTerm, ConEmu, Ghostty; NOT: Apple Terminal). The badge still works either way.'));
if (mux === 'tmux') {
  console.log('TIP: tmux does not forward notifications/titles by default. In ~/.tmux.conf:');
  console.log('     set -g allow-passthrough on   # notifications (tmux >= 3.3)');
  console.log('     set -g set-titles on          # window titles');
}
if (mux === 'screen') {
  console.log('TIP: GNU screen mangles truecolor and OSC sequences — the badge uses 256-color fallback; titles/notifications may not reach your terminal.');
}

// ---- verdict --------------------------------------------------
console.log('');
if (issues.length === 0) {
  console.log('VERDICT: OK — claude-pulse is wired up; the badge works in this environment.');
} else {
  console.log('VERDICT: ' + issues.length + ' issue(s) found');
  for (const i of issues) console.log('  - ' + i);
}
