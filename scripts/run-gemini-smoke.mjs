import { spawn } from 'node:child_process';
import { join } from 'node:path';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronBinary =
  process.platform === 'win32'
    ? join('node_modules', 'electron', 'dist', 'electron.exe')
    : join('node_modules', '.bin', 'electron');

const child = spawn(electronBinary, ['scripts/test-gemini-connection.cjs'], {
  env,
  shell: false,
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
