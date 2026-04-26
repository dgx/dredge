#!/usr/bin/env node
const { execSync } = require('child_process');

const bump = process.argv[2] || 'minor';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run(`npm version ${bump}`);
const { version } = require('../package.json');
run('git push --follow-tags');
run(`gh release create v${version} --generate-notes`);
