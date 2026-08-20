$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$PSScriptRoot\Tellus.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$PSScriptRoot\Tellus.vbs`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "$PSScriptRoot\resources\icon.ico,0"
$Shortcut.Description = "Tellus - Multi-Provider AI Hub"
$Shortcut.Save()
Write-Host "✅ Atalho 'Tellus.lnk' criado com sucesso!"
