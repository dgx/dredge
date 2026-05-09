#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const bump = process.argv[2] || 'minor';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run(`npm version ${bump}`);
const { version } = require('../package.json');

const notes = extractChangelogSection(version);
const notesFile = path.join(os.tmpdir(), `dredge-release-${version}.md`);
fs.writeFileSync(notesFile, notes);

run('git push --follow-tags');
try {
    run(`gh release create v${version} --notes-file "${notesFile}"`);
} finally {
    try { fs.unlinkSync(notesFile); } catch {}
}

// Extracts the body of the `## [<version>] ...` section from CHANGELOG.md so
// the GitHub release notes mirror the changelog exactly. Falls back to a bare
// compare link if the section is missing — better to ship something than to
// abort the release at this stage (the tag is already pushed).
function extractChangelogSection(v) {
    const fallback = `**Full Changelog**: https://github.com/dgx/dredge/compare/v${prevVersionGuess(v)}...v${v}`;
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    if (!fs.existsSync(changelogPath)) return fallback;
    const text = fs.readFileSync(changelogPath, 'utf-8');
    const lines = text.split(/\r?\n/);
    const headerRe = new RegExp(`^##\\s+\\[${v.replace(/\./g, '\\.')}\\]`);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (headerRe.test(lines[i])) { start = i + 1; break; }
    }
    if (start === -1) {
        console.error(`[release] no CHANGELOG section for ${v} — using fallback notes`);
        return fallback;
    }
    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
        if (/^##\s+\[/.test(lines[i])) { end = i; break; }
    }
    const body = lines.slice(start, end).join('\n').trim();
    return body || fallback;
}

function prevVersionGuess(v) {
    const [maj, min, patch] = v.split('.').map(Number);
    if (patch > 0) return `${maj}.${min}.${patch - 1}`;
    if (min > 0) return `${maj}.${min - 1}.0`;
    return `${Math.max(0, maj - 1)}.0.0`;
}
