#!/usr/bin/env node
/* ============================================================
 * Claude Pulse — statusline launcher (version-robust)
 * Registered at a STABLE path (~/.claude/claude-pulse/statusline.js)
 * so settings.json never hardcodes a versioned plugin directory.
 * It resolves the currently-installed badge.js the same way Claude
 * Code resolves the plugin, so a version bump or reinstall just works.
 * Resolution order:
 *   1. installed_plugins.json  -> the active installPath (what CC runs)
 *   2. cache glob              -> highest installed version
 *   3. marketplace clone       -> non-versioned fallback path
 * https://github.com/Lukas200512/claude-pulse
 * ========================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const PLUGINS = path.join(os.homedir(), '.claude', 'plugins');

function fromInstalled() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(PLUGINS, 'installed_plugins.json'), 'utf8'));
    const plugins = (j && j.plugins) || {};
    const key = Object.keys(plugins).find(k => k.split('@')[0] === 'claude-pulse');
    for (const e of (key ? plugins[key] : []) || []) {
      const p = e && e.installPath && path.join(e.installPath, 'statusline', 'badge.js');
      if (p && fs.existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  return null;
}

function cmpSemver(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

function fromCacheGlob() {
  const base = path.join(PLUGINS, 'cache', 'claude-pulse', 'claude-pulse');
  try {
    const versions = fs.readdirSync(base)
      .filter(v => fs.existsSync(path.join(base, v, 'statusline', 'badge.js')))
      .sort(cmpSemver);
    if (versions.length) return path.join(base, versions[versions.length - 1], 'statusline', 'badge.js');
  } catch { /* fall through */ }
  return null;
}

function fromMarketplace() {
  const p = path.join(PLUGINS, 'marketplaces', 'claude-pulse', 'statusline', 'badge.js');
  return fs.existsSync(p) ? p : null;
}

const target = fromInstalled() || fromCacheGlob() || fromMarketplace();
if (target) { try { require(target); } catch { process.stdout.write(''); } }
process.exit(0);
