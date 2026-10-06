import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const appPath = join(process.cwd(), 'dist', 'win-unpacked', 'Interview Coach.exe');

if (!existsSync(appPath)) {
  console.error('Packaged app was not found. Run npm run package first.');
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(appPath, {
  env,
  detached: true,
  shell: false,
  stdio: 'ignore'
});

child.unref();
console.log(`Started packaged app: ${appPath}`);
