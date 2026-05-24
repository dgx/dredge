#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const bump = process.argv[2] || 'minor';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const currentVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version;
const nextVersion = computeNextVersion(currentVersion, bump);

if (nextVersion) {
    assertChangelogSection(nextVersion);
} else {
    console.warn(`[release] unrecognized bump "${bump}" — skipping CHANGELOG precheck`);
}

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

// Fails fast if CHANGELOG.md has no populated `## [<version>]` section, so
// `npm version` doesn't create a tag we'd then have to undo. Without this,
// missing notes silently fall back to a bare compare link.
function assertChangelogSection(v) {
    const body = readChangelogSection(v);
    if (!body) {
        console.error(
            `[release] CHANGELOG.md is missing a populated "## [${v}]" section.\n` +
            `          Move entries from [Unreleased] into "## [${v}] — YYYY-MM-DD" before releasing.`
        );
        process.exit(1);
    }
}

function computeNextVersion(current, bumpType) {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
    if (!m) return null;
    const [maj, min, patch] = [+m[1], +m[2], +m[3]];
    switch (bumpType) {
        case 'patch': return `${maj}.${min}.${patch + 1}`;
        case 'minor': return `${maj}.${min + 1}.0`;
        case 'major': return `${maj + 1}.0.0`;
        default:
            if (/^\d+\.\d+\.\d+$/.test(bumpType)) return bumpType;
            return null;
    }
}

// Extracts the body of the `## [<version>] ...` section from CHANGELOG.md so
// the GitHub release notes mirror the changelog exactly. Falls back to a bare
// compare link if the section is missing — better to ship something than to
// abort the release at this stage (the tag is already pushed).
function extractChangelogSection(v) {
    const fallback = `**Full Changelog**: https://github.com/dgx/dredge/compare/v${prevVersionGuess(v)}...v${v}`;
    const body = readChangelogSection(v);
    if (!body) {
        console.error(`[release] no CHANGELOG section for ${v} — using fallback notes`);
        return fallback;
    }
    return body;
}

function readChangelogSection(v) {
    const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    if (!fs.existsSync(changelogPath)) return '';
    const text = fs.readFileSync(changelogPath, 'utf-8');
    const lines = text.split(/\r?\n/);
    const headerRe = new RegExp(`^##\\s+\\[${v.replace(/\./g, '\\.')}\\]`);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (headerRe.test(lines[i])) { start = i + 1; break; }
    }
    if (start === -1) return '';
    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
        if (/^##\s+\[/.test(lines[i])) { end = i; break; }
    }
    return lines.slice(start, end).join('\n').trim();
}

function prevVersionGuess(v) {
    const [maj, min, patch] = v.split('.').map(Number);
    if (patch > 0) return `${maj}.${min}.${patch - 1}`;
    if (min > 0) return `${maj}.${min - 1}.0`;
    return `${Math.max(0, maj - 1)}.0.0`;
}
