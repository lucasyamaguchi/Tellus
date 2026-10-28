import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsDir = path.resolve(__dirname, '../tests');

function findTestFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      findTestFiles(fullPath, fileList);
    } else if (item.isFile() && item.name.endsWith('.test.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const testFiles = findTestFiles(testsDir);
console.log(`\n🧪 Tellus Test Suite v1.0 — Running ${testFiles.length} test files...\n`);

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(npxCmd, ['tsx', '--test', ...testFiles], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..')
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
