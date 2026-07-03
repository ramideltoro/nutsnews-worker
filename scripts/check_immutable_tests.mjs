#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = path.join(repoRoot, '.github', 'immutable-tests.manifest');
const approvalEnv = 'NUTSNEWS_APPROVE_IMMUTABLE_TEST_CHANGES';

function runGit(args, options = {}) {
	return execFileSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', options.allowFailure ? 'pipe' : 'inherit'],
	});
}

function getBaseRef() {
	const explicit = process.env.NUTSNEWS_IMMUTABLE_TEST_BASE_REF;
	if (explicit) {
		return explicit;
	}

	const githubBaseRef = process.env.GITHUB_BASE_REF;
	if (githubBaseRef) {
		try {
			runGit(['rev-parse', '--verify', `origin/${githubBaseRef}`], { allowFailure: true });
			return `origin/${githubBaseRef}`;
		} catch {
			return githubBaseRef;
		}
	}

	try {
		runGit(['rev-parse', '--verify', 'origin/main'], { allowFailure: true });
		return 'origin/main';
	} catch {
		try {
			runGit(['rev-parse', '--verify', 'HEAD~1'], { allowFailure: true });
			return 'HEAD~1';
		} catch {
			return null;
		}
	}
}

const immutablePaths = new Set(
	fs
		.readFileSync(manifestPath, 'utf8')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#')),
);

if (process.env[approvalEnv] === 'true') {
	console.log(`Immutable test guard bypassed because ${approvalEnv}=true.`);
	process.exit(0);
}

const baseRef = getBaseRef();
if (!baseRef) {
	console.log('Immutable test guard skipped because no git base ref is available.');
	process.exit(0);
}

const diffOutput = runGit(['diff', '--name-status', `${baseRef}...HEAD`], { allowFailure: true }).trim();
if (!diffOutput) {
	console.log('Immutable test guard passed: no files changed.');
	process.exit(0);
}

const diffLines = diffOutput.split(/\r?\n/);
const manifestIntroducedInThisDiff = diffLines.some((line) => line === 'A\t.github/immutable-tests.manifest');

if (manifestIntroducedInThisDiff) {
	console.log('Immutable test guard passed: immutable-test manifest is being introduced in this diff.');
	process.exit(0);
}

const blocked = [];
for (const line of diffLines) {
	const [status, ...paths] = line.split(/\t+/);
	const changedPath = paths.at(-1);
	if (!changedPath || !immutablePaths.has(changedPath)) {
		continue;
	}

	// New immutable tests are allowed in the PR that introduces them. After merge, edits/deletes/renames are blocked.
	if (status === 'A') {
		continue;
	}

	blocked.push(`${status}\t${changedPath}`);
}

if (blocked.length > 0) {
	console.error('Immutable test guard failed. These tests/guardrails are marked non-modifiable:');
	for (const item of blocked) {
		console.error(`- ${item}`);
	}
	console.error(`Set ${approvalEnv}=true only after explicit owner approval.`);
	process.exit(1);
}

console.log('Immutable test guard passed.');
