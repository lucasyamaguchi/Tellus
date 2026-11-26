$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ExePath = "$ProjectRoot\Tellus.exe"
$IconPath = "$ProjectRoot\Tellus.ico"
$LauncherCs = "$PSScriptRoot\Launcher.cs"
$CscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$AppId = "Tellus.AgenticIDE"

# 1. Compila o Tellus.exe nativo caso não exista ou esteja desatualizado
if ((Test-Path $LauncherCs) -and (Test-Path $CscPath)) {
    Write-Host "Verificando/compilando Tellus.exe nativo..."
    & $CscPath /target:winexe /win32icon:$IconPath /out:$ExePath $LauncherCs
}

# 2. Remove atalho redundante dentro da raiz do projeto para evitar duplicidade e erro de atalho quebrado
$RootLnk = "$ProjectRoot\Tellus.lnk"
if (Test-Path $RootLnk) {
    Remove-Item $RootLnk -Force -ErrorAction SilentlyContinue
    Write-Host "Atalho redundante na raiz removido para evitar conflitos."
}

# 3. Cria atalho atualizado na Área de Trabalho (Desktop)
$Desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
if (Test-Path $Desktop) {
    $WshShell = New-Object -ComObject WScript.Shell
    $DesktopLnk = "$Desktop\Tellus.lnk"
    $Shortcut = $WshShell.CreateShortcut($DesktopLnk)
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = $ProjectRoot
    $Shortcut.IconLocation = "$IconPath,0"
    $Shortcut.Description = "Tellus - Multi-Provider Agentic AI IDE"
    $Shortcut.Save()
    Write-Host "Atalho criado com sucesso na Area de Trabalho: $DesktopLnk"
}
