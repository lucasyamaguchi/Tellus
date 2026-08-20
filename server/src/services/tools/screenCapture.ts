import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { FileParser, ParsedAttachment } from './fileParser.js';

export interface WindowSource {
  id: string;
  name: string;
  processName: string;
  title: string;
}

export class ScreenCapture {
  public static listOpenWindows(): WindowSource[] {
    const isWindows = os.platform() === 'win32';
    if (!isWindows) {
      return [{ id: 'primary', name: 'Tela Principal', processName: 'desktop', title: 'Tela Principal' }];
    }

    try {
      const psScript = `
Get-Process | Where-Object { $_.MainWindowTitle.Length -gt 0 } | ForEach-Object {
  [PSCustomObject]@{
    id = $_.Id.ToString()
    processName = $_.ProcessName
    title = $_.MainWindowTitle
  }
} | ConvertTo-Json -Compress
`;
      const output = execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
      if (!output.trim()) return [{ id: 'primary', name: 'Tela Inteira', processName: 'desktop', title: 'Tela Inteira' }];

      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      const sources: WindowSource[] = [
        { id: 'primary', name: '🖥️ Tela Inteira (Monitor Principal)', processName: 'desktop', title: 'Tela Inteira' },
        ...items.map((i: any) => ({
          id: String(i.id),
          name: `🪟 ${i.title} (${i.processName})`,
          processName: i.processName,
          title: i.title
        }))
      ];

      return sources;
    } catch {
      return [{ id: 'primary', name: 'Tela Inteira', processName: 'desktop', title: 'Tela Inteira' }];
    }
  }

  public static captureScreen(projectPath: string, targetWindowId?: string): Promise<ParsedAttachment> {
    return new Promise((resolve, reject) => {
      try {
        const id = 'screen_' + Date.now();
        const filename = `${id}.png`;
        const attachmentsDir = FileParser.getAttachmentsDir(projectPath);
        const outputPath = path.join(attachmentsDir, filename);

        const isWindows = os.platform() === 'win32';
        if (isWindows) {
          let psScript = '';

          if (targetWindowId && targetWindowId !== 'primary') {
            // Target specific window: bring to front and capture its bounds
            psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  }
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@
$proc = Get-Process -Id ${targetWindowId} -ErrorAction SilentlyContinue
if ($proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
  [Win32]::ShowWindow($proc.MainWindowHandle, 9)
  [Win32]::SetForegroundWindow($proc.MainWindowHandle)
  Start-Sleep -Milliseconds 250
  $rect = New-Object RECT
  [Win32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
  $width = [Math]::Max(100, $rect.Right - $rect.Left)
  $height = [Math]::Max(100, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))
  $bitmap.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
} else {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bitmap.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
`;
          } else {
            // Capture entire primary screen
            psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
          }

          execSync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`, { stdio: 'ignore' });
        } else {
          try {
            execSync(`screencapture -x "${outputPath}"`);
          } catch {
            execSync(`import -window root "${outputPath}"`);
          }
        }

        if (!fs.existsSync(outputPath)) {
          throw new Error('Falha ao gerar captura da tela ou janela');
        }

        const buffer = fs.readFileSync(outputPath);
        const relPath = path.relative(projectPath, outputPath).replace(/\\/g, '/');

        const attachment: ParsedAttachment = {
          id,
          name: `Captura (${new Date().toLocaleTimeString()}).png`,
          type: 'image/png',
          size: buffer.length,
          relativePath: relPath,
          previewUrl: `/api/attachments/${filename}`,
          parsedContent: `[🖼️ CAPTURA DE JANELA/TELA IMPORTADA: ${filename} - Inspecione o código, erros no editor, layout do navegador ou terminal exibido.]`,
          isImage: true,
          isAudio: false,
          isPdf: false,
          isCsv: false
        };

        resolve(attachment);
      } catch (err: any) {
        reject(err);
      }
    });
  }
}
