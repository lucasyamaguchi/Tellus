import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Save, 
  Check, 
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Sun,
  Moon,
  Clock,
  Trash2,
  Volume2,
  Mic,
  Play,
  Globe,
  FolderOpen,
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  Laptop,
  Lock,
  Unlock,
  HardDrive,
  AlertTriangle
} from 'lucide-react';
import { AppConfig, CloudProviderId, CloudStorageMonitorReport, CloudSyncConfig, SyncReport, VaultSecuritySummary } from '../types';
import { api } from '../api';
import { voiceService, VoiceOption, FISH_VOICE_PRESETS, VoiceProvider } from '../services/voiceService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig | null;
  onConfigUpdated: (newConfig: AppConfig) => void;
  onOpenCredits?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
  onOpenCredits,
}) => {
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [fishAudioKey, setFishAudioKey] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [deletedNotesRetention, setDeletedNotesRetention] = useState<'30_days' | '90_days' | '120_days' | '1_year' | 'never'>('90_days');
  const [vaultPath, setVaultPath] = useState<string>('');

  // Google Login & Multi-PC Cloud Sync States
  const [syncConfig, setSyncConfig] = useState<CloudSyncConfig>({
    enabled: false,
    autoSync: true,
    syncNotes: true,
    syncInk: true,
    syncChats: true,
    syncAiConfig: true,
    e2eeEnabled: true,
    isolateAccountNotes: true,
    cloudMirrorPath: ''
  });
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [vaultPassphraseInput, setVaultPassphraseInput] = useState('');
  const [browserAuthChallenge, setBrowserAuthChallenge] = useState<string | null>(null);
  const [browserAuthUrl, setBrowserAuthUrl] = useState<string | null>(null);
  const [vaultSecurity, setVaultSecurity] = useState<VaultSecuritySummary | null>(null);
  const [detectedCloudFolders, setDetectedCloudFolders] = useState<Array<{ provider: string; providerId?: string; label?: string; path: string; available?: boolean }>>([]);
  const [storageMonitor, setStorageMonitor] = useState<CloudStorageMonitorReport | null>(null);
  const [discoveredAccounts, setDiscoveredAccounts] = useState<Array<{ email: string; name?: string; provider: string; providerLabel?: string; mirrorPath?: string; source?: string }>>([]);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [lastSyncReport, setLastSyncReport] = useState<SyncReport | null>(null);
  const [showAddAnotherAccount, setShowAddAnotherAccount] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [peerUrlInput, setPeerUrlInput] = useState('');
  const [isPeerSyncing, setIsPeerSyncing] = useState(false);
  const [peerSyncStatusMsg, setPeerSyncStatusMsg] = useState<string | null>(null);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [updateSteps, setUpdateSteps] = useState<string[]>([]);
  
  // Localization & Strict Language States
  const [locale, setLocale] = useState<string>('pt-BR');
  const [language, setLanguage] = useState<string>('Português (Brasil)');
  const [country, setCountry] = useState<string>('Brasil');
  const [enforceStrictLanguage, setEnforceStrictLanguage] = useState<boolean>(true);

  // Voice Settings States
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('fish-audio');
  const [fishVoiceId, setFishVoiceId] = useState<string>(FISH_VOICE_PRESETS[0].id);
  const [fishModel, setFishModel] = useState<string>('s2.1-pro-free');
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  useEffect(() => {
    if (config) {
      setOpenrouterKey(config.keys.openrouter || '');
      setGoogleKey(config.keys.google || '');
      setAnthropicKey(config.keys.anthropic || '');
      setOpenaiKey(config.keys.openai || '');
      setFishAudioKey(config.keys.fishAudio || '');
      if (config.theme) setTheme(config.theme);
      if (config.deletedNotesRetention) setDeletedNotesRetention(config.deletedNotesRetention);
      if (config.vaultPath) setVaultPath(config.vaultPath);
      if (config.syncConfig) {
        setSyncConfig(config.syncConfig);
        if (config.syncConfig.googleAccount?.email) {
          setGoogleEmailInput(config.syncConfig.googleAccount.email);
          setGoogleNameInput(config.syncConfig.googleAccount.name || '');
        }
      }
      if (config.locale) setLocale(config.locale);
      if (config.language) setLanguage(config.language);
      if (config.country) setCountry(config.country);
      if (config.enforceStrictLanguage !== undefined) setEnforceStrictLanguage(config.enforceStrictLanguage);
      if (config.voiceSettings?.provider) setVoiceProvider(config.voiceSettings.provider);
      if (config.voiceSettings?.fishAudioVoiceId) setFishVoiceId(config.voiceSettings.fishAudioVoiceId);
      if (config.voiceSettings?.fishAudioModel) setFishModel(config.voiceSettings.fishAudioModel);
    }

    if (isOpen) {
      api.getSyncStatus().then(status => {
        if (status.vaultPath && !vaultPath) setVaultPath(status.vaultPath);
        if (status.detectedFolders) setDetectedCloudFolders(status.detectedFolders);
        if (status.vaultSecurity) setVaultSecurity(status.vaultSecurity);
        if (status.storageMonitor) setStorageMonitor(status.storageMonitor);
        if (Array.isArray(status.discoveredAccounts)) setDiscoveredAccounts(status.discoveredAccounts);
        if (status.syncConfig) {
          setSyncConfig(prev => ({
            ...prev,
            ...status.syncConfig,
            cloudMirrorPath: status.syncConfig?.cloudMirrorPath || status.effectiveMirrorPath
          }));
          if (status.syncConfig.peerSyncUrl) {
            setPeerUrlInput(status.syncConfig.peerSyncUrl);
          }
        }
      }).catch(() => {});

      api.getNetworkSyncInfo().then(net => {
        if (Array.isArray(net.lanUrls)) setLanUrls(net.lanUrls);
        if (net.peerSyncUrl && !peerUrlInput) setPeerUrlInput(net.peerSyncUrl);
      }).catch(() => {});
    }

    setVoiceProvider(voiceService.getVoiceProvider());
    setFishVoiceId(voiceService.getFishVoiceId());
    setFishModel(voiceService.getFishModel());

    const loadVoices = () => {
      setVoices(voiceService.getVoiceOptions());
      const pref = voiceService.getPreferredVoice();
      if (pref) setSelectedVoiceUri(pref.voiceURI);
      setSpeechRate(voiceService.getSpeechRate());
      setAutoSpeak(voiceService.getAutoSpeak());
    };
    loadVoices();
    voiceService.onVoicesReady(loadVoices);
  }, [config, isOpen]);

  // Poll external browser authentication status while waiting for user to finish in browser
  useEffect(() => {
    if (!browserAuthChallenge || !isOpen) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.pollBrowserGoogleAuth(browserAuthChallenge);
        if (res.status === 'completed') {
          setBrowserAuthChallenge(null);
          setBrowserAuthUrl(null);
          if (res.syncConfig) setSyncConfig(res.syncConfig);
          if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
          if (res.storageMonitor) setStorageMonitor(res.storageMonitor);
          const updatedCfg = await api.getConfig();
          onConfigUpdated(updatedCfg);
          window.dispatchEvent(new Event('tellus:vault-security-changed'));
        } else if (res.status === 'expired' || res.status === 'failed') {
          setBrowserAuthChallenge(null);
        }
      } catch {}
    }, 1500);
    return () => clearInterval(interval);
  }, [browserAuthChallenge, isOpen, onConfigUpdated]);

  if (!isOpen) return null;

  const formatBytes = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleSelectCloudProvider = async (provider: CloudProviderId) => {
    try {
      const res = await api.selectCloudProvider(provider);
      if (res.syncConfig) {
        setSyncConfig(prev => ({
          ...prev,
          ...res.syncConfig,
          cloudProvider: provider,
          cloudMirrorPath: res.syncConfig.cloudMirrorPath || prev.cloudMirrorPath
        }));
      }
      if (res.storageMonitor) setStorageMonitor(res.storageMonitor);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
    } catch (err: any) {
      alert(`Erro ao selecionar provedor Cloud: ${err.message}`);
    }
  };

  const handleLock2FAOnly = async () => {
    try {
      const res = await api.lock2FAVaultKeyOnly();
      if (res.syncConfig) setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(`Erro ao trancar Chave 2FA: ${err.message}`);
    }
  };

  const handleTestVoice = () => {
    if (isTestingVoice) {
      voiceService.stop();
      setIsTestingVoice(false);
      return;
    }
    setIsTestingVoice(true);
    const testPhrase = voiceProvider === 'fish-audio'
      ? (fishVoiceId === '82d13948027e4be69892dd3d0104e681'
          ? 'Olá! Eu sou o Jarvis. Síntese de voz em alta definição conectada com sucesso no Tellus.'
          : fishVoiceId === '2714f32ab7f8475fa45e277f840c8c23'
          ? 'Oie! Ahri pronta para estudar com você no Tellus. Áudio e voz funcionando perfeitamente!'
          : 'Olá! Testando a síntese de voz do Tellus em tempo real.')
      : 'Olá! Esta é a voz de síntese do Tellus configurada para você.';

    voiceService.speak(testPhrase, {
      forceProvider: voiceProvider,
      referenceId: fishVoiceId,
      voiceURI: selectedVoiceUri,
      rate: speechRate,
      onEnd: () => setIsTestingVoice(false),
      onError: () => setIsTestingVoice(false),
    });
  };

  const handlePickVaultDirectory = async () => {
    try {
      const res = await api.pickVaultDirectory();
      if (!res.cancelled && res.vaultPath) {
        setVaultPath(res.vaultPath);
        if (res.config) onConfigUpdated(res.config);
        window.dispatchEvent(new Event('tellus:vault-security-changed'));
      }
    } catch (err: any) {
      alert(`Erro ao selecionar pasta do Cofre: ${err.message}`);
    }
  };

  const handlePickMirrorDir = async () => {
    try {
      const res = await api.pickSyncMirrorDirectory();
      if (!res.cancelled && res.cloudMirrorPath) {
        setSyncConfig(prev => ({
          ...prev,
          ...(res.syncConfig || {}),
          cloudMirrorPath: res.cloudMirrorPath,
          enabled: true
        }));
        api.getStorageMonitorReport().then(setStorageMonitor).catch(() => {});
      }
    } catch (err: any) {
      alert(`Erro ao escolher pasta de sincronização: ${err.message}`);
    }
  };

  const handleLaunchBrowserAuth = async (providerOverride?: string) => {
    try {
      const chosenProvider = providerOverride || syncConfig.cloudProvider || 'google_drive';
      const res = await api.startBrowserGoogleAuth(chosenProvider);
      setBrowserAuthChallenge(res.challenge);
      setBrowserAuthUrl(res.authUrl);
    } catch (err: any) {
      alert(`Erro ao iniciar login no navegador externo: ${err.message}`);
    }
  };

  const handleGoogleLogin = async () => {
    if (!googleEmailInput.trim()) {
      alert('Informe o e-mail da sua conta Google ou Microsoft.');
      return;
    }
    if (!vaultPassphraseInput || vaultPassphraseInput.trim().length < 6) {
      alert(
        'Segurança 2FA Obrigatória: Informe sua Chave Encriptada (2º Fator — mínimo 6 caracteres) criada na 1ª vez para destrancar suas notas, chats e desenhos Ink.'
      );
      return;
    }
    setIsSyncingNow(true);
    try {
      const isMs =
        syncConfig.cloudProvider === 'microsoft_onedrive' ||
        /@(outlook|hotmail|live|msn)\./i.test(googleEmailInput.trim());
      const res = await api.loginGoogle({
        email: googleEmailInput.trim(),
        name: googleNameInput.trim() || googleEmailInput.split('@')[0],
        provider: syncConfig.cloudProvider || (isMs ? 'microsoft_onedrive' : 'google_drive'),
        vaultPassphrase: vaultPassphraseInput,
        cloudMirrorPath: syncConfig.cloudMirrorPath
      });
      setSyncConfig(res.syncConfig);
      setLastSyncReport(res.report);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      if ((res as any).storageMonitor) setStorageMonitor((res as any).storageMonitor);
      setVaultPassphraseInput('');
      setShowAddAnotherAccount(false);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
    } catch (err: any) {
      alert(`Erro na autenticação 2FA: ${err.message}`);
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      const res = await api.logoutGoogle();
      setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      setLastSyncReport(null);
      setShowAddAnotherAccount(false);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(`Erro ao desconectar conta Google: ${err.message}`);
    }
  };

  const handleSwitchSavedAccount = async (targetEmailOrLocal: string) => {
    setIsSyncingNow(true);
    try {
      const res = await api.switchAccount(targetEmailOrLocal);
      setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      if (res.report) setLastSyncReport(res.report);
      setShowAddAnotherAccount(false);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      const pass = window.prompt(
        `Informe a Chave/Senha Mestra do Cofre para desbloquear as notas de "${targetEmailOrLocal}":`
      );
      if (pass && pass.trim()) {
        try {
          const retry = await api.switchAccount(targetEmailOrLocal, pass.trim());
          setSyncConfig(retry.syncConfig);
          if (retry.vaultSecurity) setVaultSecurity(retry.vaultSecurity);
          if (retry.report) setLastSyncReport(retry.report);
          setShowAddAnotherAccount(false);
          const updatedCfg = await api.getConfig();
          onConfigUpdated(updatedCfg);
          window.dispatchEvent(new Event('tellus:vault-security-changed'));
          window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
        } catch (retryErr: any) {
          alert(retryErr.message || 'Chave Mestra incorreta.');
        }
      }
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleRemoveSavedAccount = async (email: string) => {
    if (!window.confirm(`Remover "${email}" da lista de contas salvas neste computador?`)) return;
    try {
      const res = await api.removeSavedAccount(email);
      setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleChangeVaultScope = async (scope: 'all_accessible' | 'account_only' | 'local_only') => {
    try {
      const res = await api.setVaultViewScope(scope);
      setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSyncWithPeer = async () => {
    if (!peerUrlInput.trim()) {
      alert('Informe o endereço IP da rede local do 2º computador/notebook (ex: http://192.168.15.10:3001)');
      return;
    }
    setIsPeerSyncing(true);
    setPeerSyncStatusMsg(null);
    try {
      const res = await api.syncWithPeerDevice(peerUrlInput.trim(), true);
      if (res.syncConfig) setSyncConfig(res.syncConfig);
      if (res.vaultSecurity) setVaultSecurity(res.vaultSecurity);
      if (res.success) {
        setPeerSyncStatusMsg(
          `✓ Co-Edição sincronizada com ${res.peerUrl}: ${res.notesUpdated} nota(s) e ${res.inksUpdated} folha(s) Ink mescladas!`
        );
        const updatedCfg = await api.getConfig();
        onConfigUpdated(updatedCfg);
        window.dispatchEvent(new CustomEvent('tellus:vault-updated'));
      } else {
        setPeerSyncStatusMsg(`⚠️ ${res.error || 'Não foi possível conectar ao 2º dispositivo.'}`);
      }
    } catch (err: any) {
      setPeerSyncStatusMsg(`⚠️ Erro: ${err.message}`);
    } finally {
      setIsPeerSyncing(false);
    }
  };

  const handleVaultOwnership = async (mode: 'bind_to_account' | 'release_to_local_pc') => {
    try {
      const res = await api.setVaultNotesOwnership(mode);
      setVaultSecurity(res.vaultSecurity);
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
    } catch (err: any) {
      alert(`Erro ao atualizar segurança das notas: ${err.message}`);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncingNow(true);
    try {
      await api.updateConfig({ vaultPath: vaultPath.trim() || undefined, syncConfig });
      const report = await api.syncNow();
      setLastSyncReport(report);
      if (report.syncConfig) setSyncConfig(report.syncConfig);
      if (report.vaultSecurity) setVaultSecurity(report.vaultSecurity);
      if ((report as any).storageMonitor) {
        setStorageMonitor((report as any).storageMonitor);
      } else {
        api.getStorageMonitorReport().then(setStorageMonitor).catch(() => {});
      }
      const updatedCfg = await api.getConfig();
      onConfigUpdated(updatedCfg);
      window.dispatchEvent(new Event('tellus:vault-security-changed'));
    } catch (err: any) {
      alert(`Falha ao sincronizar: ${err.message}`);
    } finally {
      setIsSyncingNow(false);
    }
  };

  const handleUpdateAndRestart = async () => {
    if (isUpdatingApp) return;
    setIsUpdatingApp(true);
    setUpdateSteps(['Sincronizando dados e baixando versão mais recente...']);
    try {
      const res = await api.updateAndRestartApp();
      setUpdateSteps(res.steps || [res.message]);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setUpdateSteps([`Erro ao atualizar: ${err.message}`]);
      setIsUpdatingApp(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Save Voice preferences locally
      voiceService.setVoiceProvider(voiceProvider);
      voiceService.setFishVoiceId(fishVoiceId);
      voiceService.setFishModel(fishModel);
      if (selectedVoiceUri) {
        voiceService.setPreferredVoice(selectedVoiceUri);
      }
      voiceService.setSpeechRate(speechRate);
      voiceService.setAutoSpeak(autoSpeak);

      const updated = await api.updateConfig({
        theme,
        deletedNotesRetention,
        vaultPath: vaultPath.trim() || undefined,
        syncConfig,
        locale,
        language,
        country,
        enforceStrictLanguage,
        voiceSettings: {
          provider: voiceProvider,
          fishAudioVoiceId: fishVoiceId,
          fishAudioModel: fishModel
        },
        keys: {
          openrouter: openrouterKey.trim() || undefined,
          google: googleKey.trim() || undefined,
          anthropic: anthropicKey.trim() || undefined,
          openai: openaiKey.trim() || undefined,
          fishAudio: fishAudioKey.trim() || undefined,
        }
      });
      onConfigUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card border border-card-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-card-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-card-border/80 shadow-sm flex items-center justify-center shrink-0">
              <img src="/logo.png" alt="Tellus" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100">Configuração do Tellus, Cofre & Nuvem</h3>
              <p className="text-[11px] text-slate-400">Pasta de notas, Login Google Multi-PC, Atualizações e Chaves de IA.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 bg-brand-cyan/10 border-b border-brand-cyan/20 flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-brand-cyan shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-brand-cyan">Privacidade & Portabilidade:</strong> Suas notas (<code>.md</code> e <code>.ink.json</code>), chats e IAs ficam no seu Cofre local e podem ser sincronizados entre seu PC principal e seu Notebook com touch/caneta.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* 1. Vault Folder Selection (Escolher Pasta ao instalar no PC / Notebook) */}
          <div className="space-y-2.5 p-3.5 rounded-xl bg-panel border border-brand-cyan/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-100 flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-brand-cyan" />
                <span>Pasta do Cofre de Notas (Tellus Vault)</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 font-mono">
                .md + .ink.json
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Escolha onde suas notas, cadernos e anotações de caneta (Ink) ficam salvos neste computador. Ao instalar em outro PC, basta escolher a pasta desejada aqui.
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
                placeholder="Ex: C:\Users\SeuUsuario\Documents\Tellus Vault"
                className="flex-1 bg-background border border-card-border rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-cyan"
              />
              <button
                type="button"
                onClick={handlePickVaultDirectory}
                className="px-3 py-2 rounded-xl bg-brand-cyan/15 hover:bg-brand-cyan/25 border border-brand-cyan/40 text-brand-cyan text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition-all"
                title="Abrir seletor de pastas do Windows"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Escolher Pasta...</span>
              </button>
            </div>
          </div>

          {/* 2. Multi-Cloud Encapsulated Sync, Platform Auth (Google / Microsoft) + 2FA Key & Storage Monitor */}
          <div className="space-y-3 p-3.5 rounded-xl bg-panel border border-indigo-500/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-100 flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-indigo-400" />
                <span>Cápsula Cloud Multi-PC (Google / Microsoft) + Chave Encriptada 2FA</span>
              </label>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center space-x-1 ${
                syncConfig.googleAccount && syncConfig.googleAccount.twoFactorUnlocked !== false
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {syncConfig.googleAccount && syncConfig.googleAccount.twoFactorUnlocked !== false ? (
                  <>
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>2FA Destrancado: {syncConfig.googleAccount.email}</span>
                  </>
                ) : syncConfig.googleAccount ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Aguardando Chave 2FA: {syncConfig.googleAccount.email}</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3 h-3 text-amber-400" />
                    <span>Modo Somente Arquivos Locais</span>
                  </>
                )}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Escolha sua nuvem (<strong>Google Drive</strong>, <strong>Microsoft OneDrive</strong> ou <strong>Dropbox</strong>) para enviar, visualizar e <strong>editar simultaneamente</strong> suas notas (<code>.md</code>), traços de caneta (<code>.ink.json</code>) e chats em 2 PCs <strong>sem precisar divulgar nenhum IP</strong>. O acesso exige login na plataforma (1º Fator) + sua <strong>Chave Encriptada 2FA</strong> criada na 1ª vez (2º Fator).
            </p>

            {/* PASSO 1: Escolher qual Cloud usar */}
            <div className="p-2.5 rounded-xl bg-background/80 border border-card-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                  <span>1. Escolha qual Cloud encapsulará seus arquivos:</span>
                </span>
                <span className="text-[10px] text-brand-cyan font-mono">
                  Sem exposição de IP • AES-256-GCM
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  {
                    id: 'google_drive' as CloudProviderId,
                    title: 'Google Drive',
                    subtitle: 'Conta Google',
                    badge: detectedCloudFolders.some(d => d.providerId === 'google_drive') ? 'Detectado no PC' : 'Recomendado'
                  },
                  {
                    id: 'microsoft_onedrive' as CloudProviderId,
                    title: 'Microsoft OneDrive',
                    subtitle: 'Conta Microsoft',
                    badge: detectedCloudFolders.some(d => d.providerId === 'microsoft_onedrive') ? 'Detectado no PC' : 'Integrado Windows'
                  },
                  {
                    id: 'dropbox' as CloudProviderId,
                    title: 'Dropbox Cloud',
                    subtitle: 'Pasta Dropbox',
                    badge: detectedCloudFolders.some(d => d.providerId === 'dropbox') ? 'Detectado no PC' : 'Multi-PC'
                  },
                  {
                    id: 'custom_cloud' as CloudProviderId,
                    title: 'Outra Cloud',
                    subtitle: 'Pasta Personalizada',
                    badge: 'iCloud / Mega / NAS'
                  }
                ].map((prov) => {
                  const currentProv = syncConfig.cloudProvider || 'google_drive';
                  const isSelected = currentProv === prov.id;
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => handleSelectCloudProvider(prov.id)}
                      className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-sm'
                          : 'bg-card border-card-border text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate">{prov.title}</div>
                      <div className="text-[9px] text-slate-400 truncate">{prov.subtitle}</div>
                      <div className={`text-[9px] mt-1 font-mono truncate ${isSelected ? 'text-brand-cyan' : 'text-indigo-300/80'}`}>
                        {prov.badge}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Caminho Encapsulado da Cloud Selecionada */}
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  value={syncConfig.cloudMirrorPath || ''}
                  onChange={(e) => setSyncConfig(prev => ({ ...prev, cloudMirrorPath: e.target.value, enabled: true }))}
                  placeholder="Pasta da Cloud selecionada (ex: G:\Meu Drive\Tellus Cloud Sync ou OneDrive\Tellus Cloud Sync)"
                  className="flex-1 bg-background border border-card-border rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={handlePickMirrorDir}
                  className="px-2.5 py-1.5 rounded-xl bg-card hover:bg-card-border border border-card-border text-slate-200 text-xs flex items-center space-x-1 shrink-0 cursor-pointer"
                  title="Escolher manualmente a pasta do Google Drive, OneDrive ou outra Cloud neste PC"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Pasta Cloud...</span>
                </button>
              </div>
            </div>

            {/* PASSO 2: Login na Plataforma (1º Fator) + Chave Encriptada 2FA (2º Fator) & Troca de Contas */}
            <div className="p-2.5 rounded-xl bg-background/80 border border-card-border space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className="text-[11px] font-bold text-slate-200">
                  2. Autenticação na Plataforma (Google / Microsoft) + Chave 2FA:
                </span>
                <div className="flex items-center gap-1.5">
                  {syncConfig.googleAccount && (
                    <button
                      type="button"
                      onClick={() => handleSwitchSavedAccount('local_only')}
                      className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[10px] font-semibold transition-all cursor-pointer"
                      title="Sai das contas e mostra apenas as notas locais livres do PC"
                    >
                      💻 Modo Somente Arquivos Locais
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGoogleEmailInput('');
                      setGoogleNameInput('');
                      setVaultPassphraseInput('');
                      setShowAddAnotherAccount(!showAddAnotherAccount);
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    {showAddAnotherAccount ? 'Fechar Login' : '+ Outra Conta (Google / Microsoft)'}
                  </button>
                </div>
              </div>

              {/* Saved Accounts List */}
              {Array.isArray(syncConfig.savedAccounts) && syncConfig.savedAccounts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {syncConfig.savedAccounts.map((acc) => {
                    const isCurrent =
                      syncConfig.googleAccount?.email?.toLowerCase() === acc.email.toLowerCase();
                    const noteCount =
                      acc.accountHash && vaultSecurity?.countsByAccountHash
                        ? vaultSecurity.countsByAccountHash[acc.accountHash] || 0
                        : 0;
                    const provBadge =
                      acc.provider === 'microsoft_onedrive' || /@(outlook|hotmail|live|msn)\./i.test(acc.email)
                        ? 'Microsoft'
                        : 'Google';
                    return (
                      <div
                        key={acc.email}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs ${
                          isCurrent
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                            : 'bg-card border-card-border text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-[11px] flex items-center gap-1.5 truncate">
                            <span>{acc.name}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-200 font-mono">
                              {provBadge}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-panel border border-card-border text-slate-300 font-mono">
                              {noteCount} nota(s)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">{acc.email}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isCurrent ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
                              2FA Ativo
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSwitchSavedAccount(acc.email)}
                              disabled={isSyncingNow}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold cursor-pointer"
                            >
                              Destrancar Conta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveSavedAccount(acc.email)}
                            className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                            title="Remover esta conta da lista salva neste PC"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Filter Scope for Vault Notes */}
              <div className="pt-1.5 border-t border-card-border/60 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-300 font-medium">
                  Filtro de Notas Visíveis no Tellus Notes:
                </span>
                <div className="flex items-center gap-1">
                  {[
                    { id: 'all_accessible', label: 'Todas Acessíveis (Conta + PC)' },
                    { id: 'account_only', label: 'Só da Conta Logada' },
                    { id: 'local_only', label: `Só Arquivos Locais (${vaultSecurity?.localPcNotesCount ?? 0})` }
                  ].map((tab) => {
                    const activeScope = syncConfig.googleAccount
                      ? syncConfig.vaultViewScope || 'all_accessible'
                      : 'local_only';
                    const isSelected = activeScope === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleChangeVaultScope(tab.id as any)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-cyan/20 border border-brand-cyan/50 text-brand-cyan'
                            : 'bg-card border border-card-border text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {syncConfig.googleAccount && syncConfig.googleAccount.twoFactorUnlocked !== false && !showAddAnotherAccount ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-background/80 border border-emerald-500/30 flex-wrap gap-2">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                      {syncConfig.googleAccount.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate flex items-center space-x-1.5">
                        <span>{syncConfig.googleAccount.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                          2FA #{syncConfig.googleAccount.accountHash?.slice(0, 8) || 'E2EE'}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono truncate">{syncConfig.googleAccount.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncingNow}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingNow ? 'animate-spin' : ''}`} />
                      <span>{isSyncingNow ? 'Sincronizando...' : 'Sincronizar Cloud'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLock2FAOnly}
                      className="px-2 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      title="Tranca apenas a Chave Encriptada 2FA na memória, exigindo a chave novamente para ver as notas desta conta"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Trancar 2FA</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="px-2 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-semibold flex items-center space-x-1 transition-all cursor-pointer"
                      title="Trancar notas vinculadas e sair da conta neste PC"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair</span>
                    </button>
                  </div>
                </div>

                {/* Vault Ownership Controls when Authenticated */}
                {vaultSecurity && (
                  <div className="p-2.5 rounded-xl bg-background/70 border border-card-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-cyan" />
                        <span>Isolamento de Propriedade das Notas (Protegidas por 2FA):</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {vaultSecurity.linkedToActiveAccountCount} na cápsula da conta • {vaultSecurity.localPcNotesCount} locais do PC
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVaultOwnership('bind_to_account')}
                        className="px-2.5 py-1 rounded-lg bg-brand-cyan/15 hover:bg-brand-cyan/25 border border-brand-cyan/40 text-brand-cyan text-[11px] font-semibold transition-all cursor-pointer"
                        title="Encapsula todas as notas atuais na sua conta (exigirão login + Chave 2FA em qualquer PC)"
                      >
                        🔒 Encapsular Notas na Minha Conta + 2FA ({vaultSecurity.localPcNotesCount})
                      </button>
                      {vaultSecurity.linkedToActiveAccountCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleVaultOwnership('release_to_local_pc')}
                          className="px-2.5 py-1 rounded-lg bg-card hover:bg-card-border border border-card-border text-slate-300 text-[11px] transition-all cursor-pointer"
                          title="Transforma as notas vinculadas em notas locais visíveis neste PC mesmo desconectado"
                        >
                          🔓 Liberar para Vault Local do PC
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5 p-3 rounded-xl bg-background/80 border border-card-border">
                {/* Primary Option: External System Browser Login (Google or Microsoft + 2FA Key) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchBrowserAuth('google_drive')}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>1º Fator Google + Chave 2FA</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchBrowserAuth('microsoft_onedrive')}
                    className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>1º Fator Microsoft + Chave 2FA</span>
                  </button>
                </div>

                {browserAuthChallenge && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-[11px] text-indigo-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-cyan shrink-0" />
                      <span>Conclua a autenticação da plataforma + Chave 2FA na guia aberta no seu navegador...</span>
                    </div>
                    {browserAuthUrl && (
                      <a
                        href={browserAuthUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-cyan underline font-semibold ml-2 shrink-0"
                      >
                        Reabrir janela
                      </a>
                    )}
                  </div>
                )}

                {/* Auto-Discovered Accounts on Windows (OneDrive / Google Drive) */}
                {discoveredAccounts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-slate-400">Contas detectadas neste Windows:</span>
                    {discoveredAccounts.map((dAcc) => {
                      const isMsAcc = dAcc.provider === 'microsoft_onedrive' || dAcc.provider === 'microsoft';
                      return (
                        <button
                          key={dAcc.email}
                          type="button"
                          onClick={() => {
                            setGoogleEmailInput(dAcc.email);
                            setGoogleNameInput(dAcc.name || dAcc.email.split('@')[0]);
                            handleSelectCloudProvider(
                              isMsAcc ? 'microsoft_onedrive' : 'google_drive'
                            );
                          }}
                          className="px-2 py-0.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-200 text-[10px] font-mono cursor-pointer transition-all"
                        >
                          {isMsAcc ? '🟦' : '🟩'} {dAcc.email}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Direct Unlock with Platform Email + Mandatory 2FA Encrypted Key */}
                <div className="pt-1.5 border-t border-card-border/60 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Ou destranque direto informando a Conta + sua Chave Encriptada 2FA (2º Fator):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="email"
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      placeholder="E-mail Google ou Microsoft (ex: voce@gmail.com)"
                      className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
                    />
                    <input
                      type="text"
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="Nome de exibição (opcional)"
                      className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="password"
                      value={vaultPassphraseInput}
                      onChange={(e) => setVaultPassphraseInput(e.target.value)}
                      placeholder="🔐 Chave Encriptada 2FA (criada na 1ª vez — mín. 6 caracteres)"
                      className="flex-1 bg-card border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-cyan"
                    />
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isSyncingNow}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Validar 2FA & Abrir</span>
                    </button>
                  </div>
                </div>

                {vaultSecurity && vaultSecurity.lockedForeignNotesCount > 0 && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center space-x-2">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Existem <strong>{vaultSecurity.lockedForeignNotesCount} notas encapsuladas</strong> protegidas por Chave 2FA ocultas neste PC. Autentique a conta + Chave 2FA para acessá-las.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* PASSO 3: Monitor de Armazenamento, Tamanho Encapsulado & Alerta de Limite da Conta Cloud */}
            {storageMonitor && (
              <div className={`p-3 rounded-xl border space-y-2.5 ${
                storageMonitor.isCriticalLimit
                  ? 'bg-rose-500/10 border-rose-500/40'
                  : storageMonitor.isNearLimit
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-background/80 border-card-border'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <span className="text-[11px] font-bold text-slate-100 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-brand-cyan" />
                    <span>3. Monitor de Armazenamento ({storageMonitor.providerLabel}) & Cápsula Tellus</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-300">
                      Cápsula Tellus: <strong className="text-brand-cyan">{formatBytes(storageMonitor.tellusBreakdown.totalTellusBytes)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => api.getStorageMonitorReport().then(setStorageMonitor).catch(() => {})}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-card hover:bg-card-border border border-card-border text-slate-300 cursor-pointer"
                      title="Atualizar leitura de espaço e tamanho dos arquivos"
                    >
                      ↻ Atualizar
                    </button>
                  </div>
                </div>

                {/* Quota Bar of the Cloud Account / Drive */}
                {storageMonitor.accountTotalBytes > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-300">
                        Uso total da conta/unidade: <strong>{formatBytes(storageMonitor.accountUsedBytes)}</strong> de <strong>{formatBytes(storageMonitor.accountTotalBytes)}</strong>
                        {storageMonitor.accountFreeBytes >= 0 && (
                          <span className="text-slate-400"> ({formatBytes(storageMonitor.accountFreeBytes)} livres)</span>
                        )}
                      </span>
                      <span className={`font-bold ${
                        storageMonitor.isCriticalLimit
                          ? 'text-rose-400'
                          : storageMonitor.isNearLimit
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}>
                        {storageMonitor.usagePercent}% usado
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-card overflow-hidden border border-card-border/70">
                      <div
                        className={`h-full transition-all duration-300 ${
                          storageMonitor.isCriticalLimit
                            ? 'bg-gradient-to-r from-rose-500 to-red-500'
                            : storageMonitor.isNearLimit
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                            : 'bg-gradient-to-r from-brand-cyan to-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(2, storageMonitor.usagePercent || 0))}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 font-mono">
                    Espaço encapsulado na nuvem sincronizada: <strong>{formatBytes(storageMonitor.tellusBreakdown.cloudCapsuleBytes)}</strong>
                  </div>
                )}

                {/* Near Limit Warning Alert */}
                {storageMonitor.warningMessage && (
                  <div className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 ${
                    storageMonitor.isCriticalLimit
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{storageMonitor.warningMessage}</span>
                  </div>
                )}

                {/* Encapsulated Size Breakdown by Category */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border/70">
                    <div className="text-[10px] text-slate-400">Notas (.md)</div>
                    <div className="text-xs font-bold font-mono text-slate-100">
                      {formatBytes(storageMonitor.tellusBreakdown.notesBytes)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {storageMonitor.tellusBreakdown.notesCount} arquivo(s)
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border/70">
                    <div className="text-[10px] text-slate-400">Caneta (.ink.json)</div>
                    <div className="text-xs font-bold font-mono text-brand-cyan">
                      {formatBytes(storageMonitor.tellusBreakdown.inkBytes)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {storageMonitor.tellusBreakdown.inkCount} folha(s) Ink
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border/70">
                    <div className="text-[10px] text-slate-400">Chats & IAs</div>
                    <div className="text-xs font-bold font-mono text-indigo-300">
                      {formatBytes(storageMonitor.tellusBreakdown.chatsBytes)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {storageMonitor.tellusBreakdown.chatsCount} sessão(ões)
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-card/80 border border-card-border/70">
                    <div className="text-[10px] text-slate-400">Anexos / Mídia</div>
                    <div className="text-xs font-bold font-mono text-emerald-300">
                      {formatBytes(storageMonitor.tellusBreakdown.attachmentsBytes)}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono">
                      {storageMonitor.tellusBreakdown.attachmentsCount} item(ns)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Co-Edição Simultânea via Cápsula Cloud (Zero Exposição de IP) */}
            <div className="p-2.5 rounded-xl bg-background/70 border border-brand-cyan/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-brand-cyan flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Co-Edição Simultânea via Cloud Encapsulada (Zero Exposição de IP)</span>
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan font-mono">
                  Auto-Merge .md + .ink.json
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Ao abrir a mesma nota no <strong>PC Principal</strong> e no <strong>Notebook Touch/Caneta</strong> logados na mesma Cloud + Chave 2FA, o Tellus sincroniza e mescla automaticamente os parágrafos (<code>.md</code>) e os traços de caneta (<code>.ink.json</code> por ID único de traço) direto pela cápsula da nuvem — <strong>sem precisar digitar nem expor nenhum endereço IP</strong>.
              </p>
            </div>

            {/* Sync & Security Isolation Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {[
                { key: 'syncNotes', label: 'Notas (.md)' },
                { key: 'syncInk', label: 'Caneta (.ink)' },
                { key: 'syncChats', label: 'Chats' },
                { key: 'syncAiConfig', label: 'IAs & Chaves' },
                { key: 'e2eeEnabled', label: 'Criptografia 2FA AES-256' },
                { key: 'isolateAccountNotes', label: 'Ocultar ao Sair' }
              ].map(item => (
                <label key={item.key} className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-background/60 border border-card-border/60 cursor-pointer text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={(syncConfig as any)[item.key] !== false}
                    onChange={(e) => setSyncConfig(prev => ({ ...prev, [item.key]: e.target.checked, enabled: true }))}
                    className="rounded border-card-border text-indigo-500 focus:ring-0"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {lastSyncReport && (
              <div className={`p-2 rounded-lg border text-[11px] flex items-center justify-between ${
                lastSyncReport.success
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-300'
              }`}>
                {lastSyncReport.success ? (
                  <span>
                    ✓ Cápsula 2FA sincronizada: {(lastSyncReport.notesPushed || 0) + (lastSyncReport.notesPulled || 0)} notas, {(lastSyncReport.inkPushed || 0) + (lastSyncReport.inkPulled || 0)} folhas Ink, {(lastSyncReport.chatsPushed || 0) + (lastSyncReport.chatsPulled || 0)} chats.
                  </span>
                ) : (
                  <span>⚠️ {lastSyncReport.error || lastSyncReport.errors?.[0] || 'Autentique sua conta + Chave 2FA para sincronizar.'}</span>
                )}
              </div>
            )}
          </div>

          {/* 3. One-Click Update & Restart Card */}
          <div className="space-y-2 p-3.5 rounded-xl bg-panel border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-slate-100 flex items-center space-x-2">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  <span>Atualização Rápida do Tellus</span>
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Baixa a versão mais nova, recompila as atualizações e reinicia o aplicativo automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUpdateAndRestart}
                disabled={isUpdatingApp}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm shrink-0 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingApp ? 'animate-spin' : ''}`} />
                <span>{isUpdatingApp ? 'Atualizando...' : 'Atualizar e Reiniciar'}</span>
              </button>
            </div>
            {updateSteps.length > 0 && (
              <div className="p-2 rounded-lg bg-background/80 border border-emerald-500/20 text-[11px] font-mono text-emerald-300 space-y-0.5">
                {updateSteps.map((step, i) => (
                  <div key={i}>• {step}</div>
                ))}
              </div>
            )}
          </div>

          {/* Theme Selector (Dark / Light) */}
          <div className="space-y-2 p-3 rounded-xl bg-panel border border-card-border">
            <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span>Tema da Interface</span>
            </label>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                  theme === 'dark'
                    ? 'bg-accent/20 border-accent text-accent-light shadow-sm'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Tema Escuro (Padrão)</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center space-x-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                  theme === 'light'
                    ? 'bg-accent/20 border-accent text-accent-light shadow-sm'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Tema Claro</span>
              </button>
            </div>
          </div>

          {/* Deleted Notes Retention Setting */}
          <div className="space-y-2 p-3 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Retenção de Notas Excluídas (Lixeira)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-400">
              Define o tempo que as notas e pastas excluídas permanecerão na lixeira (.backups) antes da exclusão permanente.
            </p>
            <select
              value={deletedNotesRetention}
              onChange={(e) => setDeletedNotesRetention(e.target.value as any)}
              className="w-full bg-background border border-card-border rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="30_days">30 dias</option>
              <option value="90_days">90 dias (Recomendado / Padrão)</option>
              <option value="120_days">120 dias</option>
              <option value="1_year">1 ano</option>
              <option value="never">Sempre (Nunca excluir definitivamente)</option>
            </select>
          </div>

          {/* Regional Localization & Strict Language Setting */}
          <div className="space-y-3 p-3.5 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Localização & Idioma da IA</span>
              </label>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono">
                {locale} • {language}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Define o país e idioma de resposta para todas as IAs (chat, geração de notas e voz). Evita contaminações linguísticas indesejadas (como espanhol ou portunhol).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  País / Região
                </label>
                <select
                  value={country}
                  onChange={(e) => {
                    const c = e.target.value;
                    setCountry(c);
                    if (c === 'Brasil') {
                      setLocale('pt-BR');
                      setLanguage('Português (Brasil)');
                    } else if (c === 'Portugal') {
                      setLocale('pt-PT');
                      setLanguage('Português (Portugal)');
                    } else if (c === 'Estados Unidos') {
                      setLocale('en-US');
                      setLanguage('English (US)');
                    } else if (c === 'Espanha') {
                      setLocale('es-ES');
                      setLanguage('Español');
                    } else if (c === 'Japão') {
                      setLocale('ja-JP');
                      setLanguage('日本語');
                    } else if (c === 'Alemanha') {
                      setLocale('de-DE');
                      setLanguage('Deutsch');
                    } else if (c === 'França') {
                      setLocale('fr-FR');
                      setLanguage('Français');
                    }
                  }}
                  className="w-full bg-background border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="Brasil">Brasil 🇧🇷</option>
                  <option value="Portugal">Portugal 🇵🇹</option>
                  <option value="Estados Unidos">Estados Unidos 🇺🇸</option>
                  <option value="Espanha">Espanha 🇪🇸</option>
                  <option value="Japão">Japão 🇯🇵</option>
                  <option value="Alemanha">Alemanha 🇩🇪</option>
                  <option value="França">França 🇫🇷</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Idioma de Resposta
                </label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Português (Brasil)"
                  className="w-full bg-background border border-card-border rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Código Locale
                </label>
                <input
                  type="text"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  placeholder="pt-BR"
                  className="w-full bg-background border border-card-border rounded-xl px-2.5 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <label className="flex items-center space-x-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={enforceStrictLanguage}
                onChange={(e) => setEnforceStrictLanguage(e.target.checked)}
                className="rounded border-card-border text-accent focus:ring-accent bg-background"
              />
              <span className="text-[11px] text-slate-300">
                <strong>Harness Rigorosa de Idioma:</strong> Forçar estritamente o modelo a nunca desviar para espanhol ou portunhol em títulos, pastas ou respostas.
              </span>
            </label>
          </div>

          {/* Voice & Speech Synthesis Settings */}
          <div className="space-y-3.5 p-3.5 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Volume2 className="w-4 h-4 text-brand-cyan" />
                <span>Voz e Síntese de Fala (Áudio & Live Chat)</span>
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan font-mono">
                {voiceProvider === 'fish-audio' ? 'Fish Audio AI' : 'Web Speech'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Escolha o mecanismo de voz do assistente para ouvir as respostas no chat e para o modo de estudo Live Voice.
            </p>

            {/* Provider Toggle Tabs */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setVoiceProvider('fish-audio')}
                className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  voiceProvider === 'fish-audio'
                    ? 'bg-gradient-to-r from-brand-cyan/20 to-accent/20 border-brand-cyan text-brand-cyan shadow-sm shadow-brand-cyan/10'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Fish Audio AI (Recomendado)</span>
              </button>
              <button
                type="button"
                onClick={() => setVoiceProvider('system')}
                className={`flex items-center justify-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  voiceProvider === 'system'
                    ? 'bg-accent/20 border-accent text-accent-light shadow-sm'
                    : 'bg-card border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Voz do Sistema (Nativa)</span>
              </button>
            </div>

            {/* Fish Audio Options */}
            {voiceProvider === 'fish-audio' && (
              <div className="space-y-2.5 p-3 rounded-xl bg-card border border-brand-cyan/25 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-brand-cyan flex items-center space-x-1.5">
                    <Sparkles className="w-3 h-3" />
                    <span>Modelos de Voz Expressiva (Suporte pt-BR)</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                    Tier Gratuito Ativo
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {FISH_VOICE_PRESETS.map((preset) => {
                    const isSelected = fishVoiceId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setFishVoiceId(preset.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-brand-cyan/15 border-brand-cyan text-slate-100 shadow-sm'
                            : 'bg-panel border-card-border text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{preset.name}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Voice ID or Preset Selection */}
                <div className="pt-1.5 space-y-1">
                  <label className="text-[10px] font-mono text-slate-400">ID da Voz na Fish Audio (Reference ID):</label>
                  <input
                    type="text"
                    value={fishVoiceId}
                    onChange={(e) => setFishVoiceId(e.target.value)}
                    placeholder="Ex: 5161d41404314212af1254556477c17d"
                    className="w-full bg-background border border-card-border rounded-xl px-3 py-1.5 text-xs font-mono text-brand-cyan focus:outline-none focus:border-brand-cyan"
                  />
                  <p className="text-[9px] text-slate-500">
                    Você pode colar o ID de qualquer voz da comunidade Fish Audio compartilhada publicamente.
                  </p>
                </div>

                {/* Model Backend */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-300">Modelo Fish Audio:</span>
                  <select
                    value={fishModel}
                    onChange={(e) => setFishModel(e.target.value)}
                    className="bg-background border border-card-border rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-brand-cyan cursor-pointer"
                  >
                    <option value="s2.1-pro-free">s2.1-pro-free (100% Gratuito - $0.00)</option>
                    <option value="s2.1-pro">s2.1-pro (Premium Ultra-HD)</option>
                  </select>
                </div>
              </div>
            )}

            {/* System Voice Options */}
            {voiceProvider === 'system' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-300">Vozes do Sistema / Navegador:</label>
                <select
                  value={selectedVoiceUri}
                  onChange={(e) => setSelectedVoiceUri(e.target.value)}
                  className="w-full bg-background border border-card-border rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-brand-cyan cursor-pointer"
                >
                  {voices.length === 0 ? (
                    <option value="">Carregando vozes do sistema...</option>
                  ) : (
                    voices.map((v) => (
                      <option key={v.uri} value={v.uri}>
                        {v.isPortuguese ? '🇧🇷 ' : '🌐 '} {v.name} ({v.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {/* Test Voice Button */}
            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestVoice}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 border transition-all ${
                  isTestingVoice
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse'
                    : 'bg-card hover:bg-card-border border-card-border text-slate-300 hover:text-white'
                }`}
                title={isTestingVoice ? 'Parar reprodução de teste' : 'Ouvir voz selecionada'}
              >
                <Play className={`w-3 h-3 ${isTestingVoice ? 'fill-rose-400 text-rose-400' : 'fill-slate-300'}`} />
                <span>{isTestingVoice ? 'Parar Áudio' : 'Ouvir Teste de Áudio'}</span>
              </button>

              <span className="text-[10px] text-slate-400">
                {voiceProvider === 'fish-audio' ? 'Síntese via Fish Audio' : 'Síntese local'}
              </span>
            </div>

            {/* Speech Rate Slider (for system voice) */}
            {voiceProvider === 'system' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">Velocidade da Fala:</span>
                  <span className="font-mono text-brand-cyan font-semibold">{speechRate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full accent-brand-cyan cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>0.75x (Lenta)</span>
                  <span>1.0x (Padrão)</span>
                  <span>1.5x (Rápida)</span>
                </div>
              </div>
            )}

            {/* Auto-speak replies toggle */}
            <label className="flex items-center space-x-2.5 pt-1 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                className="rounded border-card-border bg-background text-brand-cyan focus:ring-0 w-3.5 h-3.5 cursor-pointer accent-brand-cyan"
              />
              <span>Ler automaticamente respostas novas do assistente com áudio</span>
            </label>
          </div>

          {/* OpenRouter Key & Live Balance */}
          <div className="space-y-2 p-3 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span>OpenRouter API Key</span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-accent-light hover:underline flex items-center space-x-1"
              >
                <span>Obter chave OpenRouter</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-card border border-card-border rounded-lg pl-3 pr-8 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
              />
              {openrouterKey && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Dá acesso a mais de 300 modelos (DeepSeek R1, Claude 3.7, Llama 3.3, Qwen 2.5, GPT-4o, etc.).
            </p>
          </div>

          {/* Fish Audio API Key */}
          <div className="space-y-1.5 p-3 rounded-xl bg-panel border border-card-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Fish Audio API Key</span>
              </label>
              <a
                href="https://fish.audio/app/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-brand-cyan hover:underline flex items-center"
              >
                fish.audio/api-keys <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <div className="relative">
              <input
                type="password"
                value={fishAudioKey}
                onChange={(e) => setFishAudioKey(e.target.value)}
                placeholder="sk-fish-..."
                className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
              />
              {fishAudioKey && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 absolute right-2.5 top-2.5" />
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Chave da Fish Audio para vozes neurais expressivas. Gratuito para uso com o modelo <code className="text-brand-cyan">s2.1-pro-free</code>.
            </p>
          </div>

          {/* Google Gemini Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">Google Gemini API Key (Opcional)</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                AI Studio <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={googleKey}
              onChange={(e) => setGoogleKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Anthropic Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">Anthropic Claude API Key (Opcional)</label>
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                Console <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* OpenAI Key */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">OpenAI API Key (Opcional)</label>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-accent-light flex items-center"
              >
                OpenAI Platform <ExternalLink className="w-2.5 h-2.5 ml-1" />
              </a>
            </div>
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-background border border-card-border rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-card-border/50">
            {onOpenCredits ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCredits();
                }}
                className="text-[11px] text-slate-400 hover:text-accent-light flex items-center space-x-1.5 transition-colors p-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-accent-light" />
                <span>Créditos & Arquitetura</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-card hover:bg-card-border border border-card-border text-xs text-slate-300 transition-colors"
              >
                Cancelar
              </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1.5 shadow-lg shadow-accent/25 transition-all"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Salvando...' : 'Salvar Chaves'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
};
