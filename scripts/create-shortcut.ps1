$ProjectRoot = "e:\Die-Sonne\Projects\AgenticIDE"
$ExePath = "$ProjectRoot\Tellus.exe"
$IconPath = "$ProjectRoot\Tellus.ico"
$AppId = "Tellus.AgenticIDE"

# 1. Project Root Shortcut
$WshShell = New-Object -ComObject WScript.Shell
$RootLnk = "$ProjectRoot\Tellus.lnk"
$Shortcut1 = $WshShell.CreateShortcut($RootLnk)
$Shortcut1.TargetPath = $ExePath
$Shortcut1.WorkingDirectory = $ProjectRoot
$Shortcut1.IconLocation = "$IconPath,0"
$Shortcut1.Description = "Tellus - Multi-Provider Agentic AI IDE"
$Shortcut1.Save()

Write-Host "Atalho criado com sucesso na raiz: $RootLnk"

# 2. Desktop Shortcut
$Desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
if (Test-Path $Desktop) {
    $DesktopLnk = "$Desktop\Tellus.lnk"
    $Shortcut2 = $WshShell.CreateShortcut($DesktopLnk)
    $Shortcut2.TargetPath = $ExePath
    $Shortcut2.WorkingDirectory = $ProjectRoot
    $Shortcut2.IconLocation = "$IconPath,0"
    $Shortcut2.Description = "Tellus - Multi-Provider Agentic AI IDE"
    $Shortcut2.Save()
    Write-Host "Atalho criado com sucesso no Desktop: $DesktopLnk"
}

