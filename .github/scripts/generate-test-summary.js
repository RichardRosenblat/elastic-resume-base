'use strict';

/**
 * Reads per-package Jest JSON result files, builds a Markdown summary, writes it to
 * the GitHub Step Summary, and posts/updates a sticky comment on the PR.
 *
 * Environment variables consumed:
 *   RESULTS_DIR       – directory containing <id>-results.json files (required)
 *   PACKAGES_CONFIG   – path to test-packages.json (falls back to ../ci-config/test-packages.json)
 *   COMMIT_SHA        – full commit SHA (first 7 chars used)
 *   PR_NUMBER         – pull request number (omit to skip PR comment)
 *   GITHUB_TOKEN      – token with pull-requests:write (required for PR comment)
 *   REPO              – "owner/repo" string (required for PR comment)
 *   MODE              – "informational" (default) | "strict" (exit 1 when tests fail)
 *   TESTS_SKIPPED     – "true" when the test matrix was skipped intentionally
 *   GITHUB_STEP_SUMMARY – path to the step-summary file (set automatically by Actions)
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

// ── Environment ─────────────────────────────────────────────────────────────
const resultsDir      = process.env.RESULTS_DIR || process.env.GITHUB_WORKSPACE || '.';
const configPath      = process.env.PACKAGES_CONFIG ||
                        path.resolve(__dirname, '../ci-config/test-packages.json');
const commitSha       = (process.env.COMMIT_SHA || '').slice(0, 7);
const prNumber        = process.env.PR_NUMBER;
const githubToken     = process.env.GITHUB_TOKEN;
const repo            = process.env.REPO;
const mode            = process.env.MODE || 'informational';
const testsSkipped    = process.env.TESTS_SKIPPED === 'true';
const stepSummaryFile = process.env.GITHUB_STEP_SUMMARY;

// Marker used to find and update the bot comment across runs
const COMMENT_MARKER = '<!-- pr-test-results -->';

// ── Load package config ──────────────────────────────────────────────────────
const packages = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// ── Parse results ────────────────────────────────────────────────────────────
let totalPassed    = 0;
let totalFailed    = 0;
let totalSkipped   = 0;
let totalDurationMs = 0;
let hasAnyResults  = false;
const rows = [];

for (const pkg of packages) {
  const resultsFile = path.join(resultsDir, `${pkg.id}-results.json`);

  if (!fs.existsSync(resultsFile)) {
    rows.push({ pkg, status: 'missing', passed: 0, failed: 0, skipped: 0, durationMs: null, coverage: null });
    continue;
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  } catch {
    rows.push({ pkg, status: 'invalid', passed: 0, failed: 0, skipped: 0, durationMs: null, coverage: null });
    continue;
  }

  hasAnyResults = true;

  const passed  = results.numPassedTests  || 0;
  const failed  = results.numFailedTests  || 0;
  const skipped = results.numPendingTests || 0;

  // Sum per-file runtimes for wall-clock duration (tests run --runInBand so sum == total)
  let durationMs = 0;
  if (Array.isArray(results.testResults)) {
    for (const r of results.testResults) {
      if (r.perfStats && typeof r.perfStats.runtime === 'number') {
        durationMs += r.perfStats.runtime;
      }
    }
  }

  totalPassed     += passed;
  totalFailed     += failed;
  totalSkipped    += skipped;
  totalDurationMs += durationMs;

  // ── Coverage ───────────────────────────────────────────────────────────────
  let coverage = null;
  const coverageFile = path.join(resultsDir, `${pkg.id}-coverage-summary.json`);
  if (fs.existsSync(coverageFile)) {
    try {
      const cov = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));
      if (cov.total) {
        coverage = {
          lines:     cov.total.lines?.pct     ?? null,
          branches:  cov.total.branches?.pct  ?? null,
          functions: cov.total.functions?.pct ?? null,
        };
      }
    } catch {
      // Coverage file present but unreadable — treat as unavailable.
    }
  }

  rows.push({ pkg, status: results.success ? 'passed' : 'failed', passed, failed, skipped, durationMs, coverage });
}

// ── Sort: failed packages first, then alphabetically ─────────────────────────
rows.sort((a, b) => {
  if (a.failed !== b.failed) return b.failed - a.failed;
  return a.pkg.name.localeCompare(b.pkg.name);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtPassRate(passed, total) {
  if (total === 0) return '—';
  return `${Math.round((passed / total) * 100)}%`;
}

function fmtCoverage(pct) {
  if (pct === null || pct === undefined) return '—';
  const n = typeof pct === 'number' ? Math.round(pct) : NaN;
  if (isNaN(n)) return '—';
  // Color-code thresholds: <50% ❌, 50-79% ⚠️, ≥80% ✅
  const icon = n < 50 ? '🔴' : n < 80 ? '🟡' : '🟢';
  return `${icon} ${n}%`;
}

function statusBadge(status) {
  switch (status) {
    case 'passed':  return '✅ Passed';
    case 'failed':  return '❌ Failed';
    case 'missing': return '⚠️ No results';
    case 'invalid': return '⚠️ Invalid results';
    default:        return '❓ Unknown';
  }
}

// ── Build Markdown ────────────────────────────────────────────────────────────
const timestamp  = new Date().toUTCString();
const totalTests = totalPassed + totalFailed + totalSkipped;
const passRate   = fmtPassRate(totalPassed, totalTests);

let headline;
if (testsSkipped || !hasAnyResults) {
  headline = '> ⏭️ No tests were run for this change.';
} else if (totalFailed === 0) {
  headline = `> ✅ All **${totalTests}** tests passed! Pass rate: **${passRate}**`;
} else {
  headline = `> ❌ **${totalFailed}** test(s) failed out of **${totalTests}** total. Pass rate: **${passRate}**`;
}

const tableRows = rows.map(r => {
  const pkgLabel = r.status === 'failed' ? `**${r.pkg.name}**` : r.pkg.name;
  const rowTotal = r.passed + r.failed + r.skipped;
  const cov = r.coverage;
  return [
    `| ${pkgLabel}`,
    statusBadge(r.status),
    r.passed,
    r.failed,
    r.skipped,
    fmtPassRate(r.passed, rowTotal),
    fmtDuration(r.durationMs),
    cov ? fmtCoverage(cov.lines)     : '—',
    cov ? fmtCoverage(cov.branches)  : '—',
    `${cov ? fmtCoverage(cov.functions) : '—'} |`,
  ].join(' | ');
});

const failedPackages = rows.filter(r => r.status === 'failed');
const failureSection = failedPackages.length > 0
  ? [
      '',
      '### ❌ Failed Packages',
      '',
      ...failedPackages.map(r => `- **${r.pkg.name}**: ${r.failed} failed, ${r.passed} passed`),
    ].join('\n')
  : '';

const modeNote = mode === 'strict'
  ? '> ⚠️ Running in **strict mode** — this workflow fails if any tests fail.'
  : '> ℹ️ Running in **informational mode** — this check will never block a PR from being merged.';

const lines = [
  COMMENT_MARKER,
  '## 🧪 Test Results',
  '',
  `**Commit:** \`${commitSha || 'unknown'}\` | **Run at:** ${timestamp} | **Total duration:** ${fmtDuration(totalDurationMs)}`,
  '',
  headline,
  failureSection,
  '',
  '| Package | Status | ✅ Passed | ❌ Failed | ⏭️ Skipped | 📊 Pass Rate | ⏱️ Duration | 📝 Lines | 🌿 Branches | 🔧 Functions |',
  '|---------|--------|----------:|----------:|----------:|----------:|----------:|----------:|----------:|----------:|',
  ...tableRows,
  `| **Total** | | **${totalPassed}** | **${totalFailed}** | **${totalSkipped}** | **${passRate}** | **${fmtDuration(totalDurationMs)}** | | | |`,
  '',
  modeNote,
];

const markdown = lines.join('\n');

// ── GitHub Step Summary ───────────────────────────────────────────────────────
if (stepSummaryFile) {
  fs.appendFileSync(stepSummaryFile, markdown + '\n');
} else {
  console.log('--- STEP SUMMARY (GITHUB_STEP_SUMMARY not set) ---');
  console.log(markdown);
}

// ── Post / update sticky PR comment ──────────────────────────────────────────
async function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path:     urlPath,
      method,
      headers: {
        Authorization:  `Bearer ${githubToken}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent':   'pr-test-results-bot/1.0',
      },
    };
    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function postPRComment() {
  if (!prNumber || !githubToken || !repo) {
    console.log('Skipping PR comment (PR_NUMBER, GITHUB_TOKEN, or REPO not set).');
    return;
  }

  const [owner, repoName] = repo.split('/');

  const listRes = await apiRequest('GET', `/repos/${owner}/${repoName}/issues/${prNumber}/comments`);
  if (listRes.status !== 200) {
    console.warn(`Could not list PR comments (HTTP ${listRes.status}) — skipping comment.`);
    return;
  }

  const existing = Array.isArray(listRes.body) &&
    listRes.body.find(c => typeof c.body === 'string' && c.body.includes(COMMENT_MARKER));

  if (existing) {
    const res = await apiRequest('PATCH', `/repos/${owner}/${repoName}/issues/comments/${existing.id}`, { body: markdown });
    if (res.status === 200) {
      console.log(`Updated existing PR comment #${existing.id}.`);
    } else {
      console.warn(`Failed to update PR comment (HTTP ${res.status}).`);
    }
  } else {
    const res = await apiRequest('POST', `/repos/${owner}/${repoName}/issues/${prNumber}/comments`, { body: markdown });
    if (res.status === 201) {
      console.log(`Created new PR comment #${res.body.id}.`);
    } else {
      console.warn(`Failed to create PR comment (HTTP ${res.status}).`);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await postPRComment();

  if (mode === 'strict' && totalFailed > 0) {
    console.error(`\n❌ Strict mode: ${totalFailed} test(s) failed — exiting with code 1.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error in summary script:', err.message);
  process.exit(1);
});
