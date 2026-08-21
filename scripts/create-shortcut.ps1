$WshShell = New-Object -ComObject WScript.Shell

$ProjectRoot = "e:\Die-Sonne\Projects\AgenticIDE"
$VbsPath = "$ProjectRoot\Tellus.vbs"
$IconPath = "$ProjectRoot\resources\icon.ico"

# 1. Project Root Shortcut
$RootLnk = "$ProjectRoot\Tellus.lnk"
$Shortcut1 = $WshShell.CreateShortcut($RootLnk)
$Shortcut1.TargetPath = "wscript.exe"
$Shortcut1.Arguments = "`"$VbsPath`""
$Shortcut1.WorkingDirectory = $ProjectRoot
$Shortcut1.IconLocation = "$IconPath,0"
$Shortcut1.Description = "Tellus - Multi-Provider AI Hub and Knowledge Vault"
$Shortcut1.Save()

Write-Host "Atalho criado com sucesso na raiz: $RootLnk"

# 2. Desktop Shortcut
$Desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
if (Test-Path $Desktop) {
    $DesktopLnk = "$Desktop\Tellus.lnk"
    $Shortcut2 = $WshShell.CreateShortcut($DesktopLnk)
    $Shortcut2.TargetPath = "wscript.exe"
    $Shortcut2.Arguments = "`"$VbsPath`""
    $Shortcut2.WorkingDirectory = $ProjectRoot
    $Shortcut2.IconLocation = "$IconPath,0"
    $Shortcut2.Description = "Tellus - Multi-Provider AI Hub and Knowledge Vault"
    $Shortcut2.Save()
    Write-Host "Atalho criado com sucesso no Desktop: $DesktopLnk"
}
