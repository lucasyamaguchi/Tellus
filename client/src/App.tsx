import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar, LanguageOption } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { CodeViewer } from './components/CodeViewer';
import { MemoryInspector } from './components/MemoryInspector';
import { TerminalView } from './components/TerminalView';
import { FrankNoteView } from './components/FrankNoteView';
import { SkillsAndArtifactsView } from './components/SkillsAndArtifactsView';
import { ModelSelectorModal } from './components/ModelSelectorModal';
import { SettingsModal } from './components/SettingsModal';
import { ProjectModal } from './components/ProjectModal';
import { MentionModal } from './components/MentionModal';
import { WindowPickerModal } from './components/WindowPickerModal';
import { FloatingOverlay } from './components/FloatingOverlay';
import { PipelineMindMapModal } from './components/PipelineMindMapModal';
import { LiveVoiceModal } from './components/LiveVoiceModal';
import { CreditsModal } from './components/CreditsModal';
import { Maximize2, Minimize2, X, Minus } from 'lucide-react';
import { 
  AppConfig, 
  OpenRouterModel, 
  ProjectOverview, 
  FileTreeItem, 
  MemoryPage, 
  Routine, 
  Message, 
  ToolCallItem,
  ChatSessionMetadata,
  ChatSession,
  QuotedMessage,
  Attachment,
  FrankNote,
  AgentPipelineConfig
} from './types';
import { api } from './api';
import { voiceService } from './services/voiceService';
import { voiceToneAnalyzer } from './services/voiceToneAnalyzer';
import { parseLiveResponse } from './components/LiveVoiceModal';

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentProject, setCurrentProject] = useState<ProjectOverview | null>(null);
  const [models, setModels] = useState<{ curated: OpenRouterModel[]; all: OpenRouterModel[] }>({ curated: [], all: [] });
  const [activeModel, setActiveModel] = useState<string>('deepseek/deepseek-r1');
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);

  // Top-Level Main View Mode: Agent Workspace vs FrankMD Notes vs Skills
  const [mainViewMode, setMainViewMode] = useState<'agent' | 'notes' | 'skills'>('agent');

  // Chat & Session State
  const [sessions, setSessions] = useState<ChatSessionMetadata[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Per-Chat Live Voice State & Modes
  const [isLiveVoiceActiveInChat, setIsLiveVoiceActiveInChat] = useState<boolean>(false);
  const [chatLiveVoiceMode, setChatLiveVoiceMode] = useState<'voice_only' | 'mixed' | 'voice_output_only'>('mixed');
  const isLiveVoiceActiveInChatRef = useRef<boolean>(false);
  useEffect(() => {
    isLiveVoiceActiveInChatRef.current = isLiveVoiceActiveInChat;
  }, [isLiveVoiceActiveInChat]);

  // Panel & Resizing Layout State
  const [sidebarWidth, setSidebarWidth] = useState<number>(240);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(440);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState<boolean>(false);
  const [isDraggingRightPanel, setIsDraggingRightPanel] = useState<boolean>(false);
  const [isRightPanelMaximized, setIsRightPanelMaximized] = useState<boolean>(false);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeMemoryPage, setActiveMemoryPage] = useState<MemoryPage | null>(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<'code' | 'memory' | 'terminal'>('code');

  // Modals & Overlay Mode
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isMentionModalOpen, setIsMentionModalOpen] = useState<boolean>(false);
  const [isWindowPickerOpen, setIsWindowPickerOpen] = useState<boolean>(false);
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState<boolean>(false);
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState<boolean>(false);
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);
  const [openProjects, setOpenProjects] = useState<ProjectOverview[]>([]);

  // Token Efficiency & Multi-Agent Pipeline State
  const [tokenEfficiency, setTokenEfficiency] = useState<boolean>(false);
  const [agentPipeline, setAgentPipeline] = useState<AgentPipelineConfig | undefined>(undefined);

  // Target Note navigation from Chat
  const [targetNoteIdOrTitle, setTargetNoteIdOrTitle] = useState<string | null>(null);

  // Theme State (Dark / Light)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    api.updateConfig({ theme: nextTheme }).then(c => setConfig(c));
  };

  const loadOpenProjects = async () => {
    try {
      const list = await api.getOpenProjects();
      setOpenProjects(list);
    } catch {
      // ignore
    }
  };

  // Initial Load
  useEffect(() => {
    // 1. Load config
    api.getConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.theme) setTheme(cfg.theme);
      if (cfg.defaultModel) setActiveModel(cfg.defaultModel);
      if (cfg.customRoutines && cfg.customRoutines.length > 0) {
        setActiveRoutine(cfg.customRoutines[0]);
      }
    });

    // 2. Load models
    api.getModels().then((m) => setModels(m)).catch(() => {});

    // 3. Load current project & open projects & sessions
    loadProjectOverview();
    loadOpenProjects();
    loadSessions();
  }, []);

  // Mouse drag handlers for resizable splitters
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingSidebar) {
      const newWidth = Math.min(Math.max(e.clientX, 160), 450);
      setSidebarWidth(newWidth);
    } else if (isDraggingRightPanel) {
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 260), 850);
      setRightPanelWidth(newWidth);
    }
  }, [isDraggingSidebar, isDraggingRightPanel]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSidebar(false);
    setIsDraggingRightPanel(false);
  }, []);

  useEffect(() => {
    if (isDraggingSidebar || isDraggingRightPanel) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, isDraggingRightPanel, handleMouseMove, handleMouseUp]);

  const loadProjectOverview = async () => {
    try {
      const overview = await api.getCurrentProject();
      setCurrentProject(overview);
    } catch {
      // ignore
    }
  };

  const loadSessions = async () => {
    try {
      const list = await api.listSessions();
      setSessions(list);
      if (list.length > 0 && !activeSessionId) {
        handleSelectSession(list[0].id);
      } else if (list.length === 0) {
        await handleNewSession();
      }
    } catch {
      // ignore
    }
  };

  const handleNewSession = async () => {
    handleStopStreaming();
    setIsStreaming(false);
    setIsLiveVoiceOpen(false);
    try {
      voiceToneAnalyzer.stop();
    } catch {}
    try {
      voiceService.stopAll();
    } catch {}
    const newId = 'session_' + Math.random().toString(36).substring(2, 9);
    setActiveSessionId(newId);
    setMessages([]);
    setQuotedMessage(null);
    setMainViewMode('agent');
    setIsLiveVoiceActiveInChat(false);
    setChatLiveVoiceMode('mixed');
    const pipeline = {
      primaryModel: activeModel,
      plannerModel: '',
      codingModel: '',
      reasoningModel: '',
      fastToolsModel: ''
    };
    setAgentPipeline(pipeline);
    try {
      await api.saveSession({
        id: newId,
        title: 'Novo Chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: activeModel,
        routineId: activeRoutine?.id,
        tokenEfficiency,
        pipeline,
        messages: [],
        isLiveVoice: false,
        liveVoiceMode: 'mixed'
      });
      const list = await api.listSessions();
      setSessions(list);
    } catch {
      // ignore
    }
  };

  const handleStartLiveVoiceChat = async (
    mode: 'voice_only' | 'mixed' | 'voice_output_only' = 'mixed',
    customTitle?: string,
    initialPrompt?: string
  ) => {
    handleStopStreaming();
    const newId = 'session_' + Math.random().toString(36).substring(2, 9);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const title = customTitle || `🎙️ Live Voice (${timeStr})`;
    setActiveSessionId(newId);
    setMessages([]);
    setQuotedMessage(null);
    setIsStreaming(false);
    setMainViewMode('agent');
    setIsLiveVoiceActiveInChat(true);
    setChatLiveVoiceMode(mode);
    setAgentPipeline({
      primaryModel: activeModel,
      plannerModel: '',
      codingModel: '',
      reasoningModel: '',
      fastToolsModel: ''
    });
    try {
      await api.saveSession({
        id: newId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: activeModel,
        routineId: activeRoutine?.id,
        tokenEfficiency,
        pipeline: agentPipeline,
        messages: [],
        isLiveVoice: true,
        liveVoiceMode: mode
      });
      api.listSessions().then(list => setSessions(list));
      if (initialPrompt) {
        setTimeout(() => {
          handleSendMessage(initialPrompt);
        }, 150);
      }
    } catch {
      // ignore
    }
  };

  const handleToggleLiveVoiceInChat = () => {
    const nextActive = !isLiveVoiceActiveInChat;
    setIsLiveVoiceActiveInChat(nextActive);
    if (activeSessionId) {
      saveCurrentSession(messages, nextActive, chatLiveVoiceMode);
    }
  };

  const handleChangeLiveVoiceMode = (mode: 'voice_only' | 'mixed' | 'voice_output_only') => {
    setChatLiveVoiceMode(mode);
    if (activeSessionId) {
      saveCurrentSession(messages, isLiveVoiceActiveInChat, mode);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    handleStopStreaming();
    setIsStreaming(false);
    setIsLiveVoiceOpen(false);
    try {
      voiceToneAnalyzer.stop();
    } catch {}
    try {
      voiceService.stopAll();
    } catch {}
    setMainViewMode('agent');
    try {
      const session = await api.getSession(sessionId);
      if (session) {
        setActiveSessionId(session.id);
        setMessages(session.messages || []);
        setIsLiveVoiceActiveInChat(!!session.isLiveVoice);
        setChatLiveVoiceMode(session.liveVoiceMode || 'mixed');

        if (session.model) {
          const cleanModel = session.model.replace(/:batch$/i, '').trim();
          setActiveModel(cleanModel);
          if (session.pipeline) {
            setAgentPipeline(session.pipeline);
          } else {
            setAgentPipeline({
              primaryModel: cleanModel,
              plannerModel: '',
              codingModel: '',
              reasoningModel: '',
              fastToolsModel: ''
            });
          }
        }
        if (session.tokenEfficiency !== undefined) setTokenEfficiency(session.tokenEfficiency);
        if (session.routineId && config?.customRoutines) {
          const r = config.customRoutines.find(cr => cr.id === session.routineId);
          if (r) setActiveRoutine(r);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    handleStopStreaming();
    setIsStreaming(false);
    setIsLiveVoiceOpen(false);
    try {
      voiceToneAnalyzer.stop();
    } catch {}
    try {
      voiceService.stopAll();
    } catch {}
    try {
      await api.deleteSession(sessionId);
      const updated = sessions.filter(s => s.id !== sessionId);
      if (updated.length === 0) {
        await handleNewSession();
      } else {
        setSessions(updated);
        if (activeSessionId === sessionId) {
          handleSelectSession(updated[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  const saveCurrentSession = async (
    currentMsgs: Message[],
    overrideLiveVoice?: boolean,
    overrideMode?: 'voice_only' | 'mixed' | 'voice_output_only'
  ) => {
    const currentId = activeSessionId || ('session_' + Math.random().toString(36).substring(2, 9));
    if (!activeSessionId) setActiveSessionId(currentId);

    const isVoice = overrideLiveVoice !== undefined ? overrideLiveVoice : isLiveVoiceActiveInChat;
    const vMode = overrideMode !== undefined ? overrideMode : chatLiveVoiceMode;

    const firstUserMsg = currentMsgs.find(m => m.role === 'user');
    const defaultTitle = isVoice ? `🎙️ Live Voice (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : 'Novo Chat';
    const title = firstUserMsg 
      ? (isVoice ? '🎙️ ' : '') + firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '...' : '') 
      : defaultTitle;

    try {
      await api.saveSession({
        id: currentId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: activeModel,
        routineId: activeRoutine?.id,
        tokenEfficiency,
        pipeline: agentPipeline,
        messages: currentMsgs,
        isLiveVoice: isVoice,
        liveVoiceMode: vMode
      });

      api.listSessions().then(list => setSessions(list));
    } catch {
      // ignore
    }
  };

  const handleSendMessage = (
    content: string, 
    attachments?: Attachment[], 
    quotedMsg?: QuotedMessage, 
    customHistory?: Message[]
  ) => {
    if (isStreaming) return;

    let enrichedPromptForLLM = content;

    if (quotedMsg) {
      enrichedPromptForLLM = `[📌 CITAÇÃO DE OUTRA CONVERSA "${quotedMsg.sessionTitle}" (${quotedMsg.role})]:\n"${quotedMsg.content}"\n\n${enrichedPromptForLLM}`;
    }

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.parsedContent) {
          enrichedPromptForLLM = `${att.parsedContent}\n\n${enrichedPromptForLLM}`;
        }
      }
    }

    const userMessage: Message = {
      id: 'msg_' + Math.random().toString(36).substring(2, 9),
      role: 'user',
      content,
      attachments,
      quotedMessage: quotedMsg,
      timestamp: Date.now()
    };

    const assistantMessageId = 'msg_' + Math.random().toString(36).substring(2, 9);
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      reasoning: '',
      toolCalls: [],
      modelUsed: activeModel,
      timestamp: Date.now()
    };

    const baseHistory = customHistory !== undefined ? customHistory : messages;
    const updatedMessages = [...baseHistory, userMessage];
    setMessages([...updatedMessages, initialAssistantMessage]);
    setIsStreaming(true);

    const apiMessages = updatedMessages.map((m, idx) => {
      if (idx === updatedMessages.length - 1) {
        return { role: m.role, content: enrichedPromptForLLM };
      }
      return { role: m.role, content: m.content };
    });

    const cancelFn = api.streamChat(
      apiMessages,
      activeModel,
      config?.defaultProvider || 'openrouter',
      activeRoutine?.id,
      tokenEfficiency,
      agentPipeline,
      (event) => {
        setMessages(prev => {
          const newMsgs = prev.map(msg => {
            if (msg.id !== assistantMessageId) return msg;

            if (event.type === 'content') {
              return { ...msg, content: msg.content + event.data };
            } else if (event.type === 'reasoning') {
              return { ...msg, reasoning: (msg.reasoning || '') + event.data };
            } else if (event.type === 'tool_start') {
              const newToolCall: ToolCallItem = {
                id: event.data.toolCallId,
                name: event.data.name,
                arguments: event.data.arguments,
                status: 'running'
              };
              return {
                ...msg,
                toolCalls: [...(msg.toolCalls || []), newToolCall]
              };
            } else if (event.type === 'tool_end') {
              const updatedToolCalls = (msg.toolCalls || []).map(tc => {
                if (tc.id === event.data.toolCallId) {
                  return {
                    ...tc,
                    result: event.data.result,
                    status: event.data.result?.error ? ('error' as const) : ('completed' as const)
                  };
                }
                return tc;
              });
              return { ...msg, toolCalls: updatedToolCalls };
            }
            return msg;
          });
          return newMsgs;
        });
      },
      () => {
        setIsStreaming(false);
        loadProjectOverview();
        setMessages(latest => {
          // Garante que se ferramentas foram executadas mas não houve texto, o assistente tem texto explicativo visível no chat
          const updated = latest.map(m => {
            if (m.id === assistantMessageId) {
              if (!m.content || !m.content.trim()) {
                if (m.toolCalls && m.toolCalls.length > 0) {
                  return {
                    ...m,
                    content: '✅ Todas as notas, diretórios e estruturas foram criados e organizados com sucesso conforme solicitado.'
                  };
                }
              }
            }
            return m;
          });

          saveCurrentSession(updated);

          // Se Live Voice estiver ativo no chat comum (e o Orbe modal não estiver aberto), sintetiza com deduplicação
          if (isLiveVoiceActiveInChatRef.current && !isLiveVoiceOpen) {
            const assistantMsg = updated.find(m => m.id === assistantMessageId);
            if (assistantMsg && assistantMsg.content) {
              voiceService.speakMessageSummary(assistantMsg.id, assistantMsg.content);
            }
          }

          return updated;
        });
      },
      (err) => {
        setIsStreaming(false);
        setMessages(prev => {
          const finalMsgs = prev.map(msg => {
            if (msg.id === assistantMessageId) {
              return {
                ...msg,
                content: msg.content + `\n\n> ⚠️ **Erro**: ${err.message || 'Falha na comunicação com o modelo.'}`
              };
            }
            return msg;
          });
          saveCurrentSession(finalMsgs);
          return finalMsgs;
        });
      }
    );

    stopStreamRef.current = cancelFn;
  };

  const handleEditAndResendMessage = (messageId: string, newContent: string) => {
    if (isStreaming) handleStopStreaming();

    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const userMsg = messages[msgIndex];
    const previousHistory = messages.slice(0, msgIndex);

    handleSendMessage(newContent, userMsg.attachments, userMsg.quotedMessage, previousHistory);
  };

  const handleRegenerateResponse = (assistantMsgId: string) => {
    if (isStreaming) handleStopStreaming();

    const msgIndex = messages.findIndex(m => m.id === assistantMsgId);
    if (msgIndex === -1) return;

    const precedingUserMsgIndex = msgIndex - 1;
    if (precedingUserMsgIndex < 0) return;

    const userMsg = messages[precedingUserMsgIndex];
    const previousHistory = messages.slice(0, precedingUserMsgIndex);

    handleSendMessage(userMsg.content, userMsg.attachments, userMsg.quotedMessage, previousHistory);
  };

  const handleStopStreaming = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    voiceService.stop();
    setIsStreaming(false);
  };

  const handleTransferVoiceMessages = (voiceMsgs: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    if (!voiceMsgs || voiceMsgs.length === 0) return;
    const mapped: Message[] = voiceMsgs.map((m, idx) => ({
      id: 'voice_' + Date.now() + '_' + idx,
      role: m.role,
      content: m.content,
      timestamp: Date.now() + idx * 10
    }));
    const updated = [...messages, ...mapped];
    setMessages(updated);
    saveCurrentSession(updated);
  };

  const handleSelectModel = (modelId: string) => {
    const cleanId = modelId.replace(/:batch$/i, '').trim();
    setActiveModel(cleanId);
    setAgentPipeline(prev => ({
      primaryModel: cleanId,
      plannerModel: prev?.plannerModel || '',
      codingModel: prev?.codingModel || '',
      reasoningModel: prev?.reasoningModel || '',
      fastToolsModel: prev?.fastToolsModel || ''
    }));
    api.updateConfig({ defaultModel: cleanId }).then((c) => setConfig(c));
  };

  const handleSelectRoutine = (routine: Routine) => {
    setActiveRoutine(routine);
    if (routine.model) {
      setActiveModel(routine.model);
    }
  };

  const handleOpenProject = async (path: string) => {
    try {
      const overview = await api.openProject(path);
      setCurrentProject(overview);
      setSelectedFile(null);
      setActiveMemoryPage(null);
      loadOpenProjects();
      loadProjectOverview();
      loadSessions();
    } catch (err: any) {
      alert(`Erro ao abrir projeto: ${err.message}`);
    }
  };

  const handleCloseOpenProject = async (path: string) => {
    try {
      await api.closeProject(path);
      const remaining = openProjects.filter(p => p.path !== path);
      setOpenProjects(remaining);
      if (currentProject?.path === path) {
        if (remaining.length > 0) {
          handleOpenProject(remaining[0].path);
        }
      }
    } catch (err: any) {
      alert(`Erro ao fechar projeto: ${err.message}`);
    }
  };

  const handleSelectWindowForCapture = async (windowId: string, windowName: string) => {
    try {
      const attachment = await api.captureScreen(windowId);
      handleSendMessage(
        `Analise a janela selecionada "${windowName}", inspecione os erros ou o código visível e aplique as correções necessárias nos arquivos do projeto.`,
        [attachment]
      );
    } catch (err: any) {
      alert(`Erro ao capturar janela: ${err.message}`);
    }
  };

  const handleSelectLanguage = async (opt: LanguageOption) => {
    try {
      const updated = await api.updateConfig({
        locale: opt.locale,
        language: opt.language,
        country: opt.country,
        enforceStrictLanguage: true
      });
      setConfig(updated);
    } catch (err: any) {
      alert(`Erro ao alterar idioma: ${err.message}`);
    }
  };

  // Anti-lock: When returning to agent mode (e.g. after editing or deleting notes, or navigating tabs),
  // immediately clear any stale background streaming locks so the chat is never disabled or stuck.
  useEffect(() => {
    if (mainViewMode === 'agent') {
      handleStopStreaming();
      setIsStreaming(false);
    }
  }, [mainViewMode]);

  return (
    <div className={`h-screen w-screen flex flex-col bg-background text-slate-100 font-sans overflow-hidden ${
      isDraggingSidebar || isDraggingRightPanel ? 'select-none' : ''
    }`}>
      {/* Top Navbar */}
      <Navbar
        config={config}
        currentProject={currentProject}
        activeModel={activeModel}
        activeRoutine={activeRoutine}
        mainViewMode={mainViewMode}
        isRightPanelOpen={isRightPanelOpen}
        rightPanelTab={rightPanelTab}
        isOverlayActive={isOverlayActive}
        tokenEfficiency={tokenEfficiency}
        hasCustomPipeline={!!(agentPipeline?.plannerModel || agentPipeline?.codingModel || agentPipeline?.reasoningModel || agentPipeline?.fastToolsModel)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenLiveVoice={() => handleStartLiveVoiceChat('mixed')}
        onSetMainViewMode={(mode) => {
          if (mode === 'agent') {
            handleStopStreaming();
            setIsStreaming(false);
          }
          setMainViewMode(mode);
        }}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onToggleOverlay={() => setIsOverlayActive(!isOverlayActive)}
        onToggleTokenEfficiency={() => setTokenEfficiency(!tokenEfficiency)}
        onOpenPipelineModal={() => setIsPipelineModalOpen(true)}
        onSetRightPanelTab={(tab) => setRightPanelTab(tab)}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
        onSelectRoutine={handleSelectRoutine}
        onSelectLanguage={handleSelectLanguage}
        onNewChat={handleNewSession}
      />

      {/* MODE 1: DEDICATED NOTION-STYLE FRANKMD NOTES & VAULT */}
      {mainViewMode === 'notes' && (
        <div className="flex-1 flex overflow-hidden">
          <FrankNoteView
            targetNoteIdOrTitle={targetNoteIdOrTitle}
            onMentionInChat={async (note) => {
              setMainViewMode('agent');
              await handleNewSession();
              setTimeout(() => {
                handleSendMessage(note.content);
              }, 100);
            }}
            onStudyTopic={async (topic) => {
              setMainViewMode('agent');
              await handleNewSession();
              setTimeout(() => {
                handleSendMessage(`Quero estudar sobre ${topic}`);
              }, 100);
            }}
            onReturnToAgent={async () => {
              setMainViewMode('agent');
              if (sessions.length === 0 || !activeSessionId) {
                await handleNewSession();
              }
            }}
            onSearchInNewChat={async (query) => {
              setMainViewMode('agent');
              await handleNewSession();
              setTimeout(() => {
                handleSendMessage(query);
              }, 120);
            }}
            onStartLiveVoice={async (topic, initialContent) => {
              const prompt = initialContent 
                ? `Quero conversar por voz e revisar sobre "${topic}". Conteúdo de referência:\n\n${initialContent.slice(0, 600)}`
                : `Olá! Quero conversar e estudar por voz sobre o tema: ${topic}`;
              handleStartLiveVoiceChat('mixed', `🎙️ Live Voice: ${topic.slice(0, 25)}`, prompt);
            }}
          />
        </div>
      )}

      {/* MODE 2: DEDICATED SKILLS & ARTIFACTS GALLERY */}
      {mainViewMode === 'skills' && (
        <div className="flex-1 flex overflow-hidden">
          <SkillsAndArtifactsView />
        </div>
      )}

      {/* MODE 3: AGENTIC IDE WORKSPACE */}
      {mainViewMode === 'agent' && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Sidebar with Dynamic Width (Hidden when right panel is maximized) */}
          {!isRightPanelMaximized && (
            <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 flex">
              <div className="w-full">
                <Sidebar
                  currentProject={currentProject}
                  openProjects={openProjects}
                  onCloseOpenProject={handleCloseOpenProject}
                  fileTree={currentProject?.fileTree || []}
                  memoryPages={currentProject?.memoryPages || []}
                  routines={config?.customRoutines || []}
                  activeRoutine={activeRoutine}
                  selectedFile={selectedFile}
                  onSelectFile={(filePath) => {
                    setSelectedFile(filePath);
                    setRightPanelTab('code');
                    if (!isRightPanelOpen) setIsRightPanelOpen(true);
                  }}
                  onSelectMemoryPage={(page) => {
                    setActiveMemoryPage(page);
                    setRightPanelTab('memory');
                    if (!isRightPanelOpen) setIsRightPanelOpen(true);
                  }}
                  onSelectRoutine={handleSelectRoutine}
                  onOpenProjectModal={() => setIsProjectModalOpen(true)}
                  onSwitchProject={handleOpenProject}
                  onOpenNotes={() => setMainViewMode('notes')}
                  onOpenSkills={() => setMainViewMode('skills')}
                  recentProjects={config?.recentProjects || []}
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  onSelectSession={handleSelectSession}
                  onNewSession={handleNewSession}
                  onDeleteSession={handleDeleteSession}
                />
              </div>
            </div>
          )}

          {/* Resizable Splitter 1: Left Sidebar Drag Handle */}
          {!isRightPanelMaximized && (
            <div
              onMouseDown={() => setIsDraggingSidebar(true)}
              className={`w-1 cursor-col-resize hover:bg-accent transition-colors z-10 ${
                isDraggingSidebar ? 'bg-accent' : 'bg-transparent hover:bg-accent/50'
              }`}
              title="Arraste para redimensionar barra lateral"
            />
          )}

          {/* Center: Antigravity Chat Area (Hidden when right panel is maximized) */}
          {!isRightPanelMaximized && (
            <div className="flex-1 flex flex-col min-w-[320px] overflow-hidden">
              <ChatArea
                key={activeSessionId || 'default'}
                activeSessionId={activeSessionId}
                activeSessionTitle={sessions.find(s => s.id === activeSessionId)?.title}
                onQuoteSnippet={(quoted) => setQuotedMessage(quoted)}
                messages={messages}
                isStreaming={isStreaming}
                activeModel={activeModel}
                activeRoutine={activeRoutine}
                onSendMessage={handleSendMessage}
                onStopStreaming={handleStopStreaming}
                onClearChat={handleNewSession}
                onNewChat={handleNewSession}
                onQuickAction={(action) => handleSendMessage(action)}
                onSelectRoutine={handleSelectRoutine}
                onOpenMentionModal={() => setIsMentionModalOpen(true)}
                onOpenWindowPicker={() => setIsWindowPickerOpen(true)}
                onOpenLiveVoice={() => handleStartLiveVoiceChat('mixed')}
                isLiveVoiceActive={isLiveVoiceActiveInChat}
                isLiveVoiceModalOpen={isLiveVoiceOpen}
                liveVoiceMode={chatLiveVoiceMode}
                onToggleLiveVoice={handleToggleLiveVoiceInChat}
                onChangeLiveVoiceMode={handleChangeLiveVoiceMode}
                onOpenLiveVoiceOrb={() => setIsLiveVoiceOpen(true)}
                quotedMessage={quotedMessage}
                onClearQuotedMessage={() => setQuotedMessage(null)}
                onOpenNotes={() => setMainViewMode('notes')}
                onOpenNoteOrFile={(target) => {
                  setTargetNoteIdOrTitle(target);
                  setMainViewMode('notes');
                }}
                onEditMessage={handleEditAndResendMessage}
                onRegenerateResponse={handleRegenerateResponse}
                tokenEfficiency={tokenEfficiency}
                onToggleTokenEfficiency={() => setTokenEfficiency(!tokenEfficiency)}
              />
            </div>
          )}

          {/* Resizable Splitter 2: Right Secondary Panel Drag Handle */}
          {isRightPanelOpen && !isRightPanelMaximized && (
            <div
              onMouseDown={() => setIsDraggingRightPanel(true)}
              className={`w-1 cursor-col-resize hover:bg-accent transition-colors z-10 ${
                isDraggingRightPanel ? 'bg-accent' : 'bg-transparent hover:bg-accent/50'
              }`}
              title="Arraste para redimensionar painel lateral"
            />
          )}

          {/* Right Split Panel (Code / Memory / Terminal) with Maximize/Minimize Controls */}
          {isRightPanelOpen && (
            <aside 
              style={{ width: isRightPanelMaximized ? '100%' : `${rightPanelWidth}px` }} 
              className={`border-l border-card-border bg-sidebar flex flex-col h-[calc(100vh-3.5rem)] shadow-2xl relative ${
                isRightPanelMaximized ? 'flex-1 z-30' : 'shrink-0'
              }`}
            >
              {/* Window Controls Top Bar */}
              <div className="h-10 border-b border-card-border bg-[#0b0d13] px-3 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-slate-200 capitalize">
                    {rightPanelTab === 'code' ? 'Editor de Código' : rightPanelTab === 'memory' ? 'Memória do Projeto' : 'Terminal Integrado'}
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  {/* Maximize / Restore Toggle */}
                  <button
                    onClick={() => setIsRightPanelMaximized(!isRightPanelMaximized)}
                    className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-white transition-colors"
                    title={isRightPanelMaximized ? 'Restaurar Tamanho Normal' : 'Maximizar Painel'}
                  >
                    {isRightPanelMaximized ? (
                      <Minimize2 className="w-3.5 h-3.5 text-accent-light" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Close / Minimize Panel */}
                  <button
                    onClick={() => {
                      setIsRightPanelMaximized(false);
                      setIsRightPanelOpen(false);
                    }}
                    className="p-1 rounded-lg hover:bg-card-border text-slate-400 hover:text-rose-400 transition-colors"
                    title="Minimizar / Fechar Painel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Panel Views */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {rightPanelTab === 'code' && (
                  <CodeViewer
                    filePath={selectedFile}
                    onFileSaved={loadProjectOverview}
                  />
                )}

                {rightPanelTab === 'memory' && (
                  <MemoryInspector
                    activeMemoryPage={activeMemoryPage}
                    activeContext={currentProject?.activeContext || ''}
                    onRefreshMemory={loadProjectOverview}
                  />
                )}

                {rightPanelTab === 'terminal' && (
                  <TerminalView />
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Floating Overlay Mode (Always on Top) */}
      <FloatingOverlay
        isOpen={isOverlayActive}
        onClose={() => setIsOverlayActive(false)}
        onSendQuickCommand={(cmd, att) => handleSendMessage(cmd, att ? [att] : undefined)}
        onOpenWindowPicker={() => setIsWindowPickerOpen(true)}
      />

      {/* Modals */}
      <WindowPickerModal
        isOpen={isWindowPickerOpen}
        onClose={() => setIsWindowPickerOpen(false)}
        onSelectWindow={handleSelectWindowForCapture}
      />

      <ModelSelectorModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        curatedModels={models.curated}
        allModels={models.all}
        activeModel={activeModel}
        onSelectModel={handleSelectModel}
      />

      <PipelineMindMapModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
        primaryModel={activeModel}
        curatedModels={models.curated}
        allModels={models.all}
        currentPipeline={agentPipeline}
        onSavePipeline={(p) => setAgentPipeline(p)}
        onSelectPrimaryModel={handleSelectModel}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onConfigUpdated={(c) => {
          setConfig(c);
          api.getModels().then((m) => setModels(m)).catch(() => {});
        }}
        onOpenCredits={() => setIsCreditsModalOpen(true)}
      />

      <CreditsModal
        isOpen={isCreditsModalOpen}
        onClose={() => setIsCreditsModalOpen(false)}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        currentPath={currentProject?.path || ''}
        recentProjects={config?.recentProjects || []}
        onOpenProject={handleOpenProject}
      />

      <MentionModal
        isOpen={isMentionModalOpen}
        onClose={() => setIsMentionModalOpen(false)}
        onSelectQuote={(q) => setQuotedMessage(q)}
      />

      {/* Live Voice Chat & Study Modal */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
        activeModel={activeModel}
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onStopStreaming={handleStopStreaming}
        onTransferToChat={handleTransferVoiceMessages}
        onOpenNote={(noteTitle) => {
          setIsLiveVoiceOpen(false);
          setTargetNoteIdOrTitle(noteTitle);
          setMainViewMode('notes');
        }}
      />
    </div>
  );
};
export default App;
