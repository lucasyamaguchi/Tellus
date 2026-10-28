import React from 'react';
import { 
  FileCode, 
  Folder, 
  FolderOpen, 
  FileText, 
  FileJson, 
  Image as ImageIcon, 
  Database, 
  Terminal, 
  Settings, 
  Code2, 
  GitBranch, 
  Braces,
  Cpu,
  Layers,
  Palette,
  FileSpreadsheet,
  Globe
} from 'lucide-react';

interface MaterialFileIconProps {
  filename: string;
  isDirectory?: boolean;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export const MaterialFileIcon: React.FC<MaterialFileIconProps> = ({
  filename,
  isDirectory = false,
  isOpen = false,
  className = '',
  size = 14
}) => {
  const iconSize = `${size}px`;
  const lower = filename.toLowerCase();

  // 1. Directory Icons (Material Folder Colors & Specific Names)
  if (isDirectory) {
    let folderColor = 'text-amber-400';
    if (['src', 'source'].includes(lower)) folderColor = 'text-sky-400';
    else if (['components', 'views', 'ui'].includes(lower)) folderColor = 'text-indigo-400';
    else if (['services', 'api', 'controllers', 'routes'].includes(lower)) folderColor = 'text-emerald-400';
    else if (['tests', '__tests__', 'test', 'spec'].includes(lower)) folderColor = 'text-emerald-500';
    else if (['dist', 'build', 'out', 'dist-app'].includes(lower)) folderColor = 'text-amber-500';
    else if (['node_modules'].includes(lower)) folderColor = 'text-emerald-600 opacity-70';
    else if (['electron'].includes(lower)) folderColor = 'text-cyan-400';
    else if (['skills'].includes(lower)) folderColor = 'text-purple-400';
    else if (['docs', 'documentation'].includes(lower)) folderColor = 'text-blue-400';
    else if (['public', 'assets', 'resources', 'images'].includes(lower)) folderColor = 'text-pink-400';
    else if (['.git', '.github'].includes(lower)) folderColor = 'text-orange-500';
    else if (['sync', 'cloud'].includes(lower)) folderColor = 'text-cyan-400';

    if (isOpen) {
      return (
        <span className="shrink-0 flex items-center" title={filename}>
          <FolderOpen style={{ width: iconSize, height: iconSize }} className={`${folderColor} ${className}`} />
        </span>
      );
    }
    return (
      <span className="shrink-0 flex items-center" title={filename}>
        <Folder style={{ width: iconSize, height: iconSize }} className={`${folderColor} ${className}`} />
      </span>
    );
  }

  // 2. Special Configuration / Exact Filenames
  if (lower === 'package.json') {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center text-[10px] font-bold text-rose-500 ${className}`} title="Node Package (package.json)">
        <span className="leading-none">📦</span>
      </div>
    );
  }
  if (lower.startsWith('tsconfig') && lower.endsWith('.json')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[9px] bg-sky-600/30 text-sky-300 rounded-[2px] leading-none ${className}`} title="TypeScript Config">
        TS
      </div>
    );
  }
  if (lower.startsWith('.env')) {
    return (
      <span className="shrink-0 flex items-center" title="Environment Config">
        <Settings style={{ width: iconSize, height: iconSize }} className={`text-amber-300 ${className}`} />
      </span>
    );
  }
  if (lower.startsWith('.git') || lower === '.gitignore') {
    return (
      <span className="shrink-0 flex items-center" title="Git Config">
        <GitBranch style={{ width: iconSize, height: iconSize }} className={`text-orange-500 ${className}`} />
      </span>
    );
  }
  if (lower === 'dockerfile' || lower.startsWith('docker-compose')) {
    return (
      <span className="shrink-0 flex items-center" title="Docker">
        <Layers style={{ width: iconSize, height: iconSize }} className={`text-sky-400 ${className}`} />
      </span>
    );
  }
  if (lower === 'vite.config.ts' || lower === 'vite.config.js') {
    return (
      <span className="shrink-0 flex items-center" title="Vite Config">
        <Cpu style={{ width: iconSize, height: iconSize }} className={`text-purple-400 ${className}`} />
      </span>
    );
  }
  if (lower === 'tailwind.config.js' || lower === 'tailwind.config.ts') {
    return (
      <span className="shrink-0 flex items-center" title="Tailwind Config">
        <Palette style={{ width: iconSize, height: iconSize }} className={`text-teal-400 ${className}`} />
      </span>
    );
  }

  // 3. Extension Based Icons
  // React / TSX
  if (lower.endsWith('.tsx')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-[2px] leading-none ${className}`} title="React TypeScript">
        ⚛️
      </div>
    );
  }
  if (lower.endsWith('.jsx')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-[2px] leading-none ${className}`} title="React JavaScript">
        ⚛️
      </div>
    );
  }

  // TypeScript
  if (lower.endsWith('.ts') && !lower.endsWith('.d.ts')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-blue-600/30 text-blue-400 border border-blue-500/40 rounded-[2px] leading-none ${className}`} title="TypeScript">
        TS
      </div>
    );
  }
  if (lower.endsWith('.d.ts')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[7px] bg-blue-800/40 text-blue-300 border border-blue-600/40 rounded-[2px] leading-none ${className}`} title="TypeScript Declaration">
        d.ts
      </div>
    );
  }

  // JavaScript
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-amber-500/20 text-yellow-400 border border-yellow-500/40 rounded-[2px] leading-none ${className}`} title="JavaScript">
        JS
      </div>
    );
  }

  // Python
  if (lower.endsWith('.py') || lower.endsWith('.pyw') || lower.endsWith('.ipynb')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-sky-900/30 text-amber-300 border border-amber-400/40 rounded-[2px] leading-none ${className}`} title="Python">
        🐍
      </div>
    );
  }

  // Styles (CSS, SCSS, Tailwind)
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass') || lower.endsWith('.less')) {
    return (
      <span className="shrink-0 flex items-center" title="CSS / Stylesheet">
        <Palette style={{ width: iconSize, height: iconSize }} className={`text-cyan-400 ${className}`} />
      </span>
    );
  }

  // Web / HTML
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return (
      <span className="shrink-0 flex items-center" title="HTML Document">
        <Globe style={{ width: iconSize, height: iconSize }} className={`text-orange-500 ${className}`} />
      </span>
    );
  }

  // JSON & Data Formats
  if (lower.endsWith('.json') || lower.endsWith('.jsonc')) {
    return (
      <span className="shrink-0 flex items-center" title="JSON Data">
        <FileJson style={{ width: iconSize, height: iconSize }} className={`text-amber-400 ${className}`} />
      </span>
    );
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return (
      <span className="shrink-0 flex items-center" title="YAML Data">
        <Braces style={{ width: iconSize, height: iconSize }} className={`text-purple-400 ${className}`} />
      </span>
    );
  }
  if (lower.endsWith('.toml') || lower.endsWith('.ini')) {
    return (
      <span className="shrink-0 flex items-center" title="Configuration">
        <Settings style={{ width: iconSize, height: iconSize }} className={`text-slate-400 ${className}`} />
      </span>
    );
  }

  // Markdown & Docs
  if (lower.endsWith('.md') || lower.endsWith('.mdx')) {
    return (
      <span className="shrink-0 flex items-center" title="Markdown Document">
        <FileText style={{ width: iconSize, height: iconSize }} className={`text-indigo-400 ${className}`} />
      </span>
    );
  }

  // Databases & SQL
  if (lower.endsWith('.sql') || lower.endsWith('.prisma') || lower.endsWith('.sqlite') || lower.endsWith('.db')) {
    return (
      <span className="shrink-0 flex items-center" title="SQL Database">
        <Database style={{ width: iconSize, height: iconSize }} className={`text-violet-400 ${className}`} />
      </span>
    );
  }

  // Shell & Scripts
  if (lower.endsWith('.sh') || lower.endsWith('.bash') || lower.endsWith('.ps1') || lower.endsWith('.bat') || lower.endsWith('.cmd')) {
    return (
      <span className="shrink-0 flex items-center" title="Shell Script">
        <Terminal style={{ width: iconSize, height: iconSize }} className={`text-emerald-400 ${className}`} />
      </span>
    );
  }

  // Rust, Go
  if (lower.endsWith('.rs')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-orange-700/30 text-orange-400 border border-orange-500/40 rounded-[2px] leading-none ${className}`} title="Rust">
        RS
      </div>
    );
  }
  if (lower.endsWith('.go')) {
    return (
      <div style={{ width: iconSize, height: iconSize }} className={`shrink-0 flex items-center justify-center font-bold text-[8px] bg-sky-600/30 text-sky-400 border border-sky-400/40 rounded-[2px] leading-none ${className}`} title="Go">
        GO
      </div>
    );
  }

  // Images
  if (/\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i.test(lower)) {
    return (
      <span className="shrink-0 flex items-center" title="Image">
        <ImageIcon style={{ width: iconSize, height: iconSize }} className={`text-pink-400 ${className}`} />
      </span>
    );
  }

  // Spreadsheets
  if (/\.(csv|tsv|xlsx?)$/i.test(lower)) {
    return (
      <span className="shrink-0 flex items-center" title="Spreadsheet">
        <FileSpreadsheet style={{ width: iconSize, height: iconSize }} className={`text-emerald-400 ${className}`} />
      </span>
    );
  }

  // Fallback Generic File
  return (
    <span className="shrink-0 flex items-center" title={filename}>
      <FileCode style={{ width: iconSize, height: iconSize }} className={`text-slate-400 opacity-80 ${className}`} />
    </span>
  );
};
