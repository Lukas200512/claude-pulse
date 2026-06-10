#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — statusline badge
 * Reads the per-session state written by indicator.js and prints
 * a colored badge for Claude Code's status line. Cross-platform;
 * uses 24-bit ANSI (with a 256-color fallback) which Claude Code
 * renders itself (no /dev/tty).
 * Style is configurable: compact | wide | full.
 * https://github.com/Lukas200512/claude-pulse
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

// Honor CLAUDE_CONFIG_DIR (multi-profile setups); default ~/.claude.
const BASE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const DIR = path.join(BASE, 'claude-pulse');
const LEGACY_DIR = path.join(os.homedir(), '.claude', 'claude-pulse');
const SUBAGENTS_BASE = path.join(DIR, 'subagents');

function firstExisting(cands) {
  for (const f of cands) { try { fs.accessSync(f); return f; } catch { /* next */ } }
  return cands[0];
}
const CONFIG_FILE = firstExisting([path.join(DIR, 'config.conf'), path.join(LEGACY_DIR, 'config.conf')]);

const sanitizeSid = (s) => (typeof s === 'string' ? s.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) : '');

// Number of subagents currently running in THIS session = marker files
// written by the hook. Falls back to loose files at the base dir (markers
// written by pre-2.4 hook versions).
function subagentCount(sid) {
  try {
    return fs.readdirSync(path.join(SUBAGENTS_BASE, sid || '_global'), { withFileTypes: true })
      .filter(e => e.isFile()).length;
  } catch { /* fall through */ }
  try {
    return fs.readdirSync(SUBAGENTS_BASE, { withFileTypes: true }).filter(e => e.isFile()).length;
  } catch { return 0; }
}

function readState(sid) {
  const cands = sid
    ? [path.join(DIR, 'state-' + sid), path.join(DIR, 'state'), path.join(LEGACY_DIR, 'state')]
    : [path.join(DIR, 'state'), path.join(LEGACY_DIR, 'state')];
  for (const f of cands) {
    try {
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (s && typeof s.label === 'string') return s;
    } catch { /* next candidate */ }
  }
  return { label: 'Idle', icon: '.', color: '#0f1923' };
}

function readSession() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8')) || {}; } catch { return {}; }
}

function readStyle() {
  try {
    const t = fs.readFileSync(CONFIG_FILE, 'utf8');
    const m = t.match(/^\s*BADGE_STYLE\s*=\s*"?(compact|wide|full)"?/m);
    if (m) return m[1];
  } catch { /* default below */ }
  return 'wide';
}

// Read FEATURE_* flags from config (default on when absent).
function readFlags() {
  const f = {};
  try {
    const t = fs.readFileSync(CONFIG_FILE, 'utf8');
    for (const m of t.matchAll(/^\s*(FEATURE_[A-Z]+)\s*=\s*"?(on|off)"?/gm)) f[m[1]] = m[2];
  } catch { /* defaults */ }
  return f;
}
const flagOn = (f, k) => (f[k] ? f[k] === 'on' : true);

// Live duration since the turn started (stamp written by the hook on prompt).
// Falls back to the pre-2.4 shared stamp (mixed-version upgrade window), with
// a sanity cap so a stale stamp from a crashed/old session never shows hours.
function turnDuration(sid) {
  const cands = sid
    ? [path.join(DIR, 'turn-start-' + sid), path.join(DIR, 'turn-start'), path.join(LEGACY_DIR, 'turn-start')]
    : [path.join(DIR, 'turn-start'), path.join(LEGACY_DIR, 'turn-start')];
  for (const f of cands) {
    try {
      const ts = parseInt(fs.readFileSync(f, 'utf8'), 10);
      if (!Number.isFinite(ts)) continue;
      if (Date.now() - ts > 12 * 3600 * 1000) continue; // stale leftover
      let s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return s + 's';
      if (s < 3600) return Math.floor(s / 60) + 'm' + (s % 60) + 's';
      return Math.floor(s / 3600) + 'h' + Math.floor((s % 3600) / 60) + 'm';
    } catch { /* next */ }
  }
  return null;
}

// ---- color emission ------------------------------------------
// 24-bit where the terminal advertises it; otherwise the nearest cell of the
// 256-color cube, which GNU screen, Terminal.app and the linux console handle.
const TRUECOLOR = /truecolor|24bit/i.test(process.env.COLORTERM || '') ||
                  /-direct/.test(process.env.TERM || '');
function to256([r, g, b]) {
  const f = (v) => Math.round(v / 255 * 5);
  return 16 + 36 * f(r) + 6 * f(g) + f(b);
}
const bgSeq = (rgb) => TRUECOLOR ? `48;2;${rgb[0]};${rgb[1]};${rgb[2]}` : `48;5;${to256(rgb)}`;
const fgSeqRGB = (rgb) => TRUECOLOR ? `38;2;${rgb[0]};${rgb[1]};${rgb[2]}` : `38;5;${to256(rgb)}`;

// Context-window gauge: a 7-cell bar. barString() is plain (for the full bar);
// contextGauge() colours it green/amber/red by fill.
function barString(pct) {
  const cells = 7, filled = Math.max(0, Math.min(cells, Math.round(pct / 100 * cells)));
  return '▓'.repeat(filled) + '░'.repeat(cells - filled);
}
function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function contextGauge(pct, exceeds) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const hex = (p >= 90 || exceeds) ? '#e04040' : p >= 70 ? '#e0a020' : '#3ad27a';
  return `\x1b[${fgSeqRGB(hexToRgb(hex))}m\x1b[1m${barString(p)} ${p}%\x1b[0m`;
}

// Brighten a dark theme color so it reads as a small badge, preserving hue.
// Target is high enough that the label always pops as a vivid chip.
function brighten(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  let r = 80, g = 90, b = 110;
  if (m) {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  const max = Math.max(r, g, b, 1);
  const target = 210;
  const k = max < target ? target / max : 1;
  return [Math.min(255, Math.round(r * k)), Math.min(255, Math.round(g * k)), Math.min(255, Math.round(b * k))];
}

// Pick black or white text for maximum contrast on the badge background,
// so the label stays crisp on any hue (white on orange, black on green, ...).
function fgCode([r, g, b]) {
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // perceived, 0..255
  return lum > 140 ? 30 : 97; // 30 = black, 97 = bright white
}

// Permission modes → short label + fixed vivid colour (theme-independent so
// they stay legible on any theme). 'default' is intentionally absent: no chip.
const MODES = {
  plan:              { label: 'PLAN',      color: '#4a3aff' },
  acceptEdits:       { label: 'AUTO-EDIT', color: '#1f8f3a' },
  auto:              { label: 'AUTO',      color: '#00a0a0' },
  dontAsk:           { label: 'NO-ASK',    color: '#c08000' },
  bypassPermissions: { label: 'BYPASS',    color: '#c01818' },
};
const APPROVAL_COLOR = '#ff8c00'; // amber — "auto on, but this needs you"
const APPROVAL_LABEL = 'NEEDS OK';
const SUBAGENT_COLOR = '#c83ab0'; // magenta — N subagents currently running
const EFFORT = { low: 'LOW', medium: 'MED', high: 'HIGH', xhigh: 'XHIGH', max: 'MAX' };
const EFFORT_COLOR = '#5a6cf0'; // indigo — reasoning effort level

// The mode chip is shown only in these "actively working" states, where the
// hook just wrote a fresh permission mode. It is hidden when idle/done: a mode
// toggle while idle reaches neither the statusline JSON nor any hook, so an
// idle value could be stale — better to show nothing than something wrong.
const ACTIVE_KEYS = new Set([
  'thinking', 'shell', 'editing', 'reading', 'subagent', 'tool',
  'web', 'planning', 'skill', 'mcp', 'compacting',
]);

// A small colored chip with contrast-aware, always-crisp text.
function chip(text, hex) {
  const rgb = brighten(hex);
  return `\x1b[${bgSeq(rgb)}m\x1b[${fgCode(rgb)}m\x1b[1m ${text} \x1b[0m`;
}

// Claude Code injects COLUMNS into the statusline process from the live TTY
// width (documented); the stdin JSON has no width field.
function termWidth() {
  const w = parseInt(process.env.COLUMNS || '', 10);
  return Number.isFinite(w) && w > 20 ? w : 80;
}

function main() {
  const sess = readSession();
  const sid = sanitizeSid(sess.session_id);
  const st = readState(sid);
  const style = readStyle();
  const rgb = brighten(st.color);
  const fg = fgCode(rgb);
  const onColor = (text) => `\x1b[${bgSeq(rgb)}m\x1b[${fg}m\x1b[1m${text}\x1b[0m`;
  // Readable mid-grey for the secondary tail; raw ANSI dim renders too faint on some terminals.
  const dim = (text) => `\x1b[38;5;250m${text}\x1b[0m`;

  const flags = readFlags();
  const label = st.label.toUpperCase();
  const model = (sess.model && (sess.model.display_name || sess.model.id)) || '';
  let dir = '';
  const cwd = (sess.workspace && (sess.workspace.current_dir || sess.workspace.cwd)) || sess.cwd || '';
  if (cwd) dir = path.basename(cwd);

  // Permission mode: prefer the live statusline field (absent in current CC),
  // fall back to the last value the hook persisted into state. Only surfaced
  // while actively working (see ACTIVE_KEYS) so it is never shown stale.
  const mode = (typeof sess.permission_mode === 'string' && sess.permission_mode) || st.mode || 'default';
  const modeInfo = ACTIVE_KEYS.has(st.key) ? MODES[mode] : null;

  // What exactly is happening ("npm test", "badge.js", …) — written by the
  // hook from tool_input, gated there by FEATURE_DETAIL.
  const detail = typeof st.detail === 'string' ? st.detail : '';

  // Reasoning effort (effort.level), context gauge, duration, session cost.
  const effLevel = sess.effort && typeof sess.effort.level === 'string' ? sess.effort.level : '';
  const effLabel = flagOn(flags, 'FEATURE_EFFORT') && effLevel
    ? (EFFORT[effLevel] || effLevel.toUpperCase().slice(0, 6)) : null;
  const cw = sess.context_window || {};
  let pct = typeof cw.used_percentage === 'number' ? cw.used_percentage : null;
  if (pct == null && typeof cw.current_usage === 'number' && cw.context_window_size > 0) {
    pct = cw.current_usage / cw.context_window_size * 100; // fallback if used_percentage is absent
  }
  const showGauge = flagOn(flags, 'FEATURE_CONTEXT') && pct != null;
  // While running: live ticking duration. On DONE: the final duration of the
  // last turn, persisted into the state by the hook.
  const dur = flagOn(flags, 'FEATURE_DURATION')
    ? (turnDuration(sid) || (st.key === 'done' && typeof st.duration === 'string' ? st.duration : null))
    : null;
  const costUsd = sess.cost && typeof sess.cost.total_cost_usd === 'number' ? sess.cost.total_cost_usd : null;
  const cost = flagOn(flags, 'FEATURE_COST') && costUsd != null && costUsd >= 0.005
    ? '$' + costUsd.toFixed(2) : '';

  // Coloured chips for compact/wide; plain bracketed text for the full bar
  // (a single-colour bar can't show separate chip backgrounds).
  let chips = '', inlineChips = '';
  if (modeInfo) { chips += '  ' + chip(modeInfo.label, modeInfo.color); inlineChips += `  [ ${modeInfo.label} ]`; }
  if (st.needsApproval) { chips += '  ' + chip(APPROVAL_LABEL, APPROVAL_COLOR); inlineChips += `  [ ${APPROVAL_LABEL} ]`; }
  const agents = flagOn(flags, 'FEATURE_SUBAGENTS') ? subagentCount(sid) : 0; // shown whenever subagents run
  if (agents > 0) { chips += '  ' + chip(`⚙ ${agents}`, SUBAGENT_COLOR); inlineChips += `  [ ⚙ ${agents} ]`; }
  if (effLabel) { chips += '  ' + chip(effLabel, EFFORT_COLOR); inlineChips += `  [ ${effLabel} ]`; }

  // Tail: context gauge (coloured) then the grey duration · cost · model · dir.
  const gaugeWide = showGauge ? '  ' + contextGauge(pct, sess.exceeds_200k_tokens) : '';
  const gaugeInline = showGauge ? `  ${barString(Math.round(pct))} ${Math.round(pct)}%` : '';
  const greyTail = [dur ? `⏱ ${dur}` : '', cost, model, dir].filter(Boolean).join(' · ');
  const detailWide = detail ? '  ' + dim(detail) : '';

  let out;
  if (style === 'compact') {
    out = onColor(` ${st.icon} ${label} `) + detailWide + chips + gaugeWide + (greyTail ? '  ' + dim(greyTail) : '');
  } else if (style === 'full') {
    let inner = ` ${st.icon} ${label}` + (detail ? ` ${detail}` : '') + inlineChips + gaugeInline +
      (greyTail ? `  ·  ${greyTail} ` : ' ');
    const w = termWidth();
    if (inner.length < w) inner += ' '.repeat(w - inner.length);
    out = onColor(inner);
  } else { // wide (default)
    out = onColor(`    ${st.icon}  ${label}    `) + detailWide + chips + gaugeWide + (greyTail ? '  ' + dim(greyTail) : '');
  }
  process.stdout.write(out);
}

try { main(); } catch { process.stdout.write(''); }
process.exit(0);
