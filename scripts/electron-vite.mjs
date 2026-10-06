import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const electronViteBin = join(scriptDir, '../node_modules/electron-vite/bin/electron-vite.js');
const child = spawn(process.execPath, [electronViteBin, ...process.argv.slice(2)], {
  env,
  shell: false,
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
