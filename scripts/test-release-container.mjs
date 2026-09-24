import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Match the browser image to the installed project's pinned Playwright version.
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const version = pkg.devDependencies['@playwright/test'];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Pin @playwright/test to an exact version.');
const result = spawnSync('docker', [
  'run', '--rm', '--init', '--shm-size=1g',
  '--user', `${process.getuid()}:${process.getgid()}`,
  '--mount', `type=bind,source=${root},target=/work`,
  '--workdir', '/work',
  `mcr.microsoft.com/playwright:v${version}-noble`,
  'npm', 'run', 'test:release',
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
