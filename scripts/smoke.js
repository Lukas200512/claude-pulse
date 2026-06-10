#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — smoke test (no deps, < 2s)
 *   node scripts/smoke.js
 * Drives indicator.js / badge.js / register-statusline.js inside
 * a throwaway CLAUDE_CONFIG_DIR sandbox and asserts the contract
 * between them: per-session state, chips, counters, registration.
 * Exits non-zero on the first failure.
 * ========================================================== */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-smoke-'));
const ENV = { ...process.env, CLAUDE_CONFIG_DIR: SANDBOX, COLORTERM: 'truecolor' };
const DIR = path.join(SANDBOX, 'claude-pulse');

let failed = 0;
function check(name, cond) {
  if (cond) { console.log('  ok  ' + name); }
  else { console.error('FAIL  ' + name); failed++; }
}
function hook(event, payload) {
  return execFileSync(process.execPath, [path.join(ROOT, 'hooks', 'indicator.js'), event],
    { input: JSON.stringify(payload || {}), env: ENV, encoding: 'utf8' });
}
function badge(sess) {
  return execFileSync(process.execPath, [path.join(ROOT, 'statusline', 'badge.js')],
    { input: JSON.stringify(sess || {}), env: ENV, encoding: 'utf8' });
}
function register(args) {
  return execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'register-statusline.js'), ...args],
    { env: ENV, encoding: 'utf8' });
}
const readState = (sid) => JSON.parse(fs.readFileSync(path.join(DIR, 'state-' + sid), 'utf8'));

// --- per-session state + detail ---------------------------------
console.log('indicator state:');
hook('start', { session_id: 's1' });
check('SessionStart writes Ready', readState('s1').key === 'ready');
hook('prompt', { session_id: 's1', permission_mode: 'acceptEdits' });
check('prompt writes Thinking + mode', readState('s1').key === 'thinking' && readState('s1').mode === 'acceptEdits');
hook('pre', { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'npm test --silent' } });
const sh = readState('s1');
check('Bash → shell with command detail', sh.key === 'shell' && sh.detail === 'npm test --silent');
hook('pre', { session_id: 's1', tool_name: 'mcp__playwright__browser_click', tool_input: {} });
check('mcp__ tool → MCP + server detail', readState('s1').key === 'mcp' && readState('s1').detail === 'playwright:browser_click');
hook('post', { session_id: 's1' });
check('PostToolUse → back to Thinking', readState('s1').key === 'thinking');
hook('compact', { session_id: 's1' });
check('PreCompact → Compacting', readState('s1').key === 'compacting');

// --- session isolation -------------------------------------------
hook('pre', { session_id: 's2', tool_name: 'Edit', tool_input: { file_path: '/x/y/badge.js' } });
check('sessions are isolated', readState('s1').key === 'compacting' && readState('s2').detail === 'badge.js');

// --- subagent counter --------------------------------------------
console.log('subagents:');
hook('subagent-start', { session_id: 's1', agent_id: 'a1' });
hook('subagent-start', { session_id: 's1', agent_id: 'a2' });
let out = badge({ session_id: 's1' });
check('badge shows ⚙ 2 for own session', out.includes('⚙ 2'));
check('other session shows no counter', !badge({ session_id: 's2' }).includes('⚙'));
hook('subagent-stop', { session_id: 's1', agent_id: 'a1' });
check('stop decrements to 1', badge({ session_id: 's1' }).includes('⚙ 1'));
hook('subagent-stop', { session_id: 's1' }); // no agent_id → oldest-marker fallback
check('id-less stop clears the last marker', !badge({ session_id: 's1' }).includes('⚙'));

// --- approval chip + notification ---------------------------------
console.log('badge:');
out = hook('notify', { session_id: 's1', permission_mode: 'acceptEdits', notification_type: 'permission_prompt' });
check('notify emits OSC 9 input ping', out.includes(']9;Claude needs your input'));
out = badge({ session_id: 's1' });
check('NEEDS OK chip on permission prompt', out.includes('NEEDS OK'));
check('approval chip is English', !out.includes('WARTET'));

// --- duration on DONE + done ping ----------------------------------
hook('prompt', { session_id: 's1' });
out = hook('stop', { session_id: 's1' });
check('done ping includes duration', /]9;Claude is done \(\d+s\)/.test(out));
check('DONE state persists duration', typeof readState('s1').duration === 'string');
check('badge shows duration on DONE', /⏱ \d+s/.test(badge({ session_id: 's1' })));

// --- chips from statusline JSON ------------------------------------
out = badge({
  session_id: 's2', model: { display_name: 'Opus' },
  workspace: { current_dir: '/tmp/proj' },
  context_window: { used_percentage: 58 },
  effort: { level: 'xhigh' }, cost: { total_cost_usd: 0.4192 },
});
check('mode chip while active', out.includes('AUTO-EDIT') === false); // s2 never saw a mode → no chip
check('effort chip', out.includes('XHIGH'));
check('context gauge', out.includes('58%'));
check('cost chip', out.includes('$0.42'));
check('model + dir tail', out.includes('Opus') && out.includes('proj'));

// --- 256-color fallback --------------------------------------------
out = execFileSync(process.execPath, [path.join(ROOT, 'statusline', 'badge.js')],
  { input: JSON.stringify({ session_id: 's2' }), env: { ...ENV, COLORTERM: '', TERM: 'screen' }, encoding: 'utf8' });
check('non-truecolor uses 48;5;N', /48;5;\d+/.test(out) && !out.includes('48;2;'));

// --- session end cleanup -------------------------------------------
hook('end', { session_id: 's1' });
check('SessionEnd removes session files', !fs.existsSync(path.join(DIR, 'state-s1')));

// --- register-statusline -------------------------------------------
console.log('register-statusline:');
const SETTINGS = path.join(SANDBOX, 'settings.json');
fs.writeFileSync(SETTINGS, JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'node /home/u/bin/statusline.js' } }, null, 2));
register(['on', ROOT]);
let s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
check('on registers our launcher', /claude-pulse/.test(s.statusLine.command));
check('on keeps other settings', s.model === 'opus');
check('foreign statusline saved', fs.existsSync(path.join(DIR, 'previous-statusline.json')));
const bak1 = fs.readFileSync(SETTINGS + '.bak', 'utf8');
register(['on', ROOT]); // second run must not clobber the original backup
check('backup not overwritten on re-run', fs.readFileSync(SETTINGS + '.bak', 'utf8') === bak1);
register(['off']);
s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
check('off restores previous statusline', s.statusLine && s.statusLine.command === 'node /home/u/bin/statusline.js');
register(['off']); // not ours → must keep the user's statusline
s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
check('off never touches a foreign statusline', s.statusLine && /\/home\/u\/bin/.test(s.statusLine.command));
fs.writeFileSync(SETTINGS, '{ broken json');
let refused = false;
try { register(['on', ROOT]); } catch { refused = true; }
check('refuses to rewrite broken settings.json', refused && fs.readFileSync(SETTINGS, 'utf8') === '{ broken json');

// -------------------------------------------------------------------
fs.rmSync(SANDBOX, { recursive: true, force: true });
if (failed) { console.error('\n' + failed + ' check(s) FAILED'); process.exit(1); }
console.log('\nall checks passed');
