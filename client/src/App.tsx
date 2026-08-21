import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
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
  FrankNote
} from './types';
import { api } from './api';

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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState<boolean>(false);
  const [isMentionModalOpen, setIsMentionModalOpen] = useState<boolean>(false);
  const [isWindowPickerOpen, setIsWindowPickerOpen] = useState<boolean>(false);
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);

  // Initial Load
  useEffect(() => {
    // 1. Load config
    api.getConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.defaultModel) setActiveModel(cfg.defaultModel);
      if (cfg.customRoutines && cfg.customRoutines.length > 0) {
        setActiveRoutine(cfg.customRoutines[0]);
      }
    });

    // 2. Load models
    api.getModels().then((m) => setModels(m)).catch(() => {});

    // 3. Load current project & sessions
    loadProjectOverview();
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
        handleNewSession();
      }
    } catch {
      // ignore
    }
  };

  const handleNewSession = () => {
    const newId = 'session_' + Math.random().toString(36).substring(2, 9);
    setActiveSessionId(newId);
    setMessages([]);
    setQuotedMessage(null);
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const session = await api.getSession(sessionId);
      if (session) {
        setActiveSessionId(session.id);
        setMessages(session.messages || []);
        if (session.model) setActiveModel(session.model);
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
    try {
      await api.deleteSession(sessionId);
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
      if (activeSessionId === sessionId) {
        if (updated.length > 0) {
          handleSelectSession(updated[0].id);
        } else {
          handleNewSession();
        }
      }
    } catch {
      // ignore
    }
  };

  const saveCurrentSession = async (currentMsgs: Message[]) => {
    const currentId = activeSessionId || ('session_' + Math.random().toString(36).substring(2, 9));
    if (!activeSessionId) setActiveSessionId(currentId);

    const firstUserMsg = currentMsgs.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 35) + (firstUserMsg.content.length > 35 ? '...' : '') : 'Novo Chat';

    try {
      await api.saveSession({
        id: currentId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        model: activeModel,
        routineId: activeRoutine?.id,
        messages: currentMsgs
      });

      api.listSessions().then(list => setSessions(list));
    } catch {
      // ignore
    }
  };

  const handleSendMessage = (content: string, attachments?: Attachment[], quotedMsg?: QuotedMessage) => {
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

    const updatedMessages = [...messages, userMessage];
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
          saveCurrentSession(latest);
          return latest;
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

  const handleStopStreaming = () => {
    if (stopStreamRef.current) {
      stopStreamRef.current();
      stopStreamRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    api.updateConfig({ defaultModel: modelId }).then((c) => setConfig(c));
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
      loadProjectOverview();
      loadSessions();
    } catch (err: any) {
      alert(`Erro ao abrir projeto: ${err.message}`);
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
        onSetMainViewMode={setMainViewMode}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
        onToggleOverlay={() => setIsOverlayActive(!isOverlayActive)}
        onSetRightPanelTab={(tab) => setRightPanelTab(tab)}
        onOpenModelModal={() => setIsModelModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenProjectModal={() => setIsProjectModalOpen(true)}
        onSelectRoutine={handleSelectRoutine}
      />

      {/* MODE 1: DEDICATED NOTION-STYLE FRANKMD NOTES & VAULT */}
      {mainViewMode === 'notes' && (
        <div className="flex-1 flex overflow-hidden">
          <FrankNoteView
            onMentionInChat={(note) => {
              setMainViewMode('agent');
              handleSendMessage(`Sobre a anotação [[${note.title}]]:\n\n${note.content}`);
            }}
            onReturnToAgent={() => setMainViewMode('agent')}
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
                messages={messages}
                isStreaming={isStreaming}
                activeModel={activeModel}
                activeRoutine={activeRoutine}
                onSendMessage={handleSendMessage}
                onStopStreaming={handleStopStreaming}
                onClearChat={handleNewSession}
                onQuickAction={(action) => handleSendMessage(action)}
                onSelectRoutine={handleSelectRoutine}
                onOpenMentionModal={() => setIsMentionModalOpen(true)}
                onOpenWindowPicker={() => setIsWindowPickerOpen(true)}
                quotedMessage={quotedMessage}
                onClearQuotedMessage={() => setQuotedMessage(null)}
                onOpenNotes={() => setMainViewMode('notes')}
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

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={config}
        onConfigUpdated={(c) => {
          setConfig(c);
          api.getModels().then((m) => setModels(m)).catch(() => {});
        }}
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
    </div>
  );
};
export default App;
