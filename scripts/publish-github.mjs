#!/usr/bin/env node
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const ROOT_DIR = resolve(import.meta.dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  let token = process.env.GITHUB_TOKEN || '';
  let dryRun = false;
  let customVersion = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--token=')) token = arg.split('=')[1];
    else if (arg === '--token' && args[i + 1]) token = args[++i];
    else if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--version=')) customVersion = arg.split('=')[1];
    else if (arg === '--version' && args[i + 1]) customVersion = args[++i];
  }

  if (!token) {
    try {
      const remote = execSync('git remote get-url origin', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      const m = remote.match(/https:\/\/[^:]+:([^@]+)@github\.com/);
      if (m?.[1]) token = m[1];
    } catch {}
  }

  return { token: token.trim(), dryRun, customVersion: customVersion.trim() };
}

const { token, dryRun, customVersion } = parseArgs();

if (!token && !dryRun) {
  console.error('Error: GitHub Token required. Pass --token=ghp_xxx or set GITHUB_TOKEN env var.');
  process.exit(1);
}

console.log('==> Step 1/4: Building @hasnain-a-a/re-ai...');
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

console.log('==> Step 2/4: Preparing staging package...');
const stagingDir = join(tmpdir(), `re-ai-publish-${Date.now()}`);
rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(stagingDir, { recursive: true });

const originalPkg = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8'));
const version = customVersion || originalPkg.version || '1.0.0';

const publishedPkg = {
  ...originalPkg,
  version,
  publishConfig: { registry: 'https://npm.pkg.github.com' },
  files: ['dist'],
};
delete publishedPkg.devDependencies;
delete publishedPkg.scripts;

writeFileSync(join(stagingDir, 'package.json'), JSON.stringify(publishedPkg, null, 2));
cpSync(join(ROOT_DIR, 'dist'), join(stagingDir, 'dist'), { recursive: true });
if (existsSync(join(ROOT_DIR, 'README.md'))) copyFileSync(join(ROOT_DIR, 'README.md'), join(stagingDir, 'README.md'));

writeFileSync(
  join(stagingDir, '.npmrc'),
  `@hasnain-a-a:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${token}\n`,
);

console.log(`==> Step 3/4: Staged @hasnain-a-a/re-ai@${version} in ${stagingDir}`);

if (dryRun) {
  execSync('npm publish --dry-run', { cwd: stagingDir, stdio: 'inherit' });
  rmSync(stagingDir, { recursive: true, force: true });
  console.log('Dry run complete — nothing published.');
  process.exit(0);
}

console.log(`==> Step 4/4: Publishing @hasnain-a-a/re-ai@${version}...`);
try {
  execSync('npm publish', { cwd: stagingDir, stdio: 'inherit' });
  console.log(`✓ Published @hasnain-a-a/re-ai@${version} to GitHub Packages!`);
} finally {
  rmSync(stagingDir, { recursive: true, force: true });
}
