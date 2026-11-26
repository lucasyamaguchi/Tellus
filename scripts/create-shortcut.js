import { execSync } from 'child_process';
import path from 'path';

const projectRoot = path.resolve('.');
const psScriptPath = path.join(projectRoot, 'scripts', 'create-shortcut.ps1');

try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('Erro ao criar atalho do Tellus:', err);
}
