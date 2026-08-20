import { execSync } from 'child_process';
import path from 'path';

const projectRoot = path.resolve('.');
const icoPath = path.join(projectRoot, 'resources', 'icon.ico');
const vbsPath = path.join(projectRoot, 'AgenticIDE.vbs');
const lnkPath = path.join(projectRoot, 'Agentic IDE.lnk');

const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("${lnkPath.replace(/\\/g, '\\\\')}")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """${vbsPath.replace(/\\/g, '\\\\')}"""
$Shortcut.WorkingDirectory = "${projectRoot.replace(/\\/g, '\\\\')}"
$Shortcut.IconLocation = "${icoPath.replace(/\\/g, '\\\\')},0"
$Shortcut.Description = "Agentic IDE - Multi-Provider AI Studio"
$Shortcut.Save()
Write-Host "Atalho com icone criado com sucesso!"
`;

try {
  execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('Erro ao criar atalho:', err);
}
