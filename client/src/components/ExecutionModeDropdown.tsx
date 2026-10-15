import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Lock, 
  Zap, 
  Globe, 
  ChevronDown, 
  Info, 
  Settings, 
  CheckCircle2, 
  Circle 
} from 'lucide-react';
import { ExecutionSecurityPreset } from '../types';

interface ExecutionModeDropdownProps {
  currentMode?: ExecutionSecurityPreset;
  effectivePreset: 'request_review' | 'default' | 'turbo';
  globalPreset?: 'request_review' | 'default' | 'turbo';
  onSelectMode: (mode: ExecutionSecurityPreset) => void;
  onOpenDetailedSettings: () => void;
  disabled?: boolean;
}

export const ExecutionModeDropdown: React.FC<ExecutionModeDropdownProps> = ({
  currentMode = 'inherit',
  effectivePreset,
  globalPreset = 'default',
  onSelectMode,
  onOpenDetailedSettings,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getPillConfig = (preset: 'request_review' | 'default' | 'turbo') => {
    switch (preset) {
      case 'turbo':
        return {
          label: 'Turbo',
          icon: <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />,
          badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
        };
      case 'request_review':
        return {
          label: 'Request Review',
          icon: <Shield className="w-3 h-3 text-sky-400" />,
          badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-300 hover:bg-sky-500/20'
        };
      case 'default':
      default:
        return {
          label: 'Default',
          icon: <Lock className="w-3 h-3 text-emerald-400" />,
          badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
        };
    }
  };

  const pill = getPillConfig(effectivePreset);

  const options: Array<{
    mode: ExecutionSecurityPreset;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'request_review',
      title: 'Request Review',
      subtitle: 'Every command requires approval.',
      icon: <Shield className="w-4 h-4 text-sky-400 shrink-0" />
    },
    {
      mode: 'default',
      title: 'Default',
      subtitle: 'Ask before sensitive operations.',
      icon: <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
    },
    {
      mode: 'turbo',
      title: 'Turbo',
      subtitle: 'Run all commands without restrictions.',
      icon: <Zap className="w-4 h-4 text-amber-400 shrink-0 fill-amber-400/20" />
    },
    {
      mode: 'inherit',
      title: 'Use Global Settings',
      subtitle: globalPreset === 'turbo' ? 'Turbo' : globalPreset === 'request_review' ? 'Request Review' : 'Default',
      icon: <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
    }
  ];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer ${pill.badgeClass} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={`Modo de Execução do Chat: ${pill.label} (${currentMode === 'inherit' ? 'Herdado do Projeto/Global' : 'Específico deste Chat'}). Clique para alterar.`}
      >
        {pill.icon}
        <span className="font-medium">{pill.label}</span>
        {currentMode === 'inherit' && (
          <span className="text-[9px] text-slate-400 px-1 py-0.2 rounded bg-card/60">Auto</span>
        )}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {/* Dropdown Menu (Screenshot 1 parity) */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-card border border-card-border shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-sidebar/50 border-b border-card-border/60 flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold tracking-wide">Project Settings</span>
            <div 
              className="text-slate-400 hover:text-slate-200 cursor-help" 
              title="Controle o nível de supervisão sobre o agente: se ele executa ações direto ou se requer aprovação para alterações e comandos."
            >
              <Info className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Preset Options */}
          <div className="p-1.5 space-y-0.5">
            {options.map((opt) => {
              const isSelected = currentMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => {
                    onSelectMode(opt.mode);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-start space-x-2.5 cursor-pointer ${
                    isSelected 
                      ? 'bg-accent/20 border border-accent/40 text-white' 
                      : 'hover:bg-panel text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="pt-0.5">
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-accent-light shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      {opt.icon}
                      <span className="text-xs font-semibold">{opt.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Action */}
          <div className="border-t border-card-border/60 p-1.5 bg-sidebar/30">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenDetailedSettings();
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-accent-light hover:text-white hover:bg-accent/20 flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-accent-light" />
              <span className="font-medium">Configurações Detalhadas do Projeto...</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
