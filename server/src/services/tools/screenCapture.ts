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
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$procs = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Trim().Length -gt 0 } | ForEach-Object {
  [PSCustomObject]@{
    id = $_.Id.ToString()
    processName = $_.ProcessName
    title = $_.MainWindowTitle
  }
}
if ($procs) {
  $procs | ConvertTo-Json -Compress
} else {
  "[]"
}
`;
      const base64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const output = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64}`, { encoding: 'utf-8' });
      const trimmed = output.trim();
      let parsed: any[] = [];
      const jsonStart = trimmed.indexOf('[');
      const jsonEnd = trimmed.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
        parsed = JSON.parse(trimmed.substring(jsonStart, jsonEnd + 1));
      } else {
        const objStart = trimmed.indexOf('{');
        const objEnd = trimmed.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1 && objEnd >= objStart) {
          const single = JSON.parse(trimmed.substring(objStart, objEnd + 1));
          parsed = [single];
        }
      }

      const sources: WindowSource[] = [
        { id: 'primary', name: '🖥️ Tela Inteira (Monitor Principal)', processName: 'desktop', title: 'Tela Inteira' },
        ...parsed.map((i: any) => ({
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
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32Capture {
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
  [Win32Capture]::ShowWindow($proc.MainWindowHandle, 9)
  [Win32Capture]::SetForegroundWindow($proc.MainWindowHandle)
  Start-Sleep -Milliseconds 250
  $rect = New-Object RECT
  [Win32Capture]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
  $width = [Math]::Max(100, $rect.Right - $rect.Left)
  $height = [Math]::Max(100, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $width, $height))
  $bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
} else {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
  $bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}
`;
          } else {
            // Capture entire primary screen
            psScript = `
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${outputPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
          }

          const base64 = Buffer.from(psScript, 'utf16le').toString('base64');
          execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${base64}`, { stdio: 'pipe' });
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
