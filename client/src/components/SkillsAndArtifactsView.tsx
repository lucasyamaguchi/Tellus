import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Layers, 
  FileCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Brain, 
  CheckCircle2, 
  Cpu, 
  Copy, 
  Check, 
  FileCode, 
  ExternalLink,
  Shield,
  Search,
  Globe,
  FolderGit2,
  ToggleLeft,
  ToggleRight,
  Code,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TellusSkill, TellusArtifact } from '../types';
import { api } from '../api';

export const SkillsAndArtifactsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'skills' | 'artifacts'>('skills');
  const [skills, setSkills] = useState<TellusSkill[]>([]);
  const [artifacts, setArtifacts] = useState<TellusArtifact[]>([]);
  
  // Scope Filters
  const [skillScopeFilter, setSkillScopeFilter] = useState<'all' | 'global' | 'project'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [selectedArtifact, setSelectedArtifact] = useState<TellusArtifact | null>(null);
  const [isCreatingSkill, setIsCreatingSkill] = useState<boolean>(false);
  const [isCreatingArtifact, setIsCreatingArtifact] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Skill Form
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Architecture');
  const [newSkillAgent, setNewSkillAgent] = useState('all');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');
  const [newSkillIsProjectSpecific, setNewSkillIsProjectSpecific] = useState(false);

  // New Artifact Form
  const [newArtTitle, setNewArtTitle] = useState('');
  const [newArtType, setNewArtType] = useState<TellusArtifact['type']>('plan');
  const [newArtFilename, setNewArtFilename] = useState('');
  const [newArtContent, setNewArtContent] = useState('');
  const [newArtIsGlobal, setNewArtIsGlobal] = useState(false);

  const loadData = async () => {
    try {
      const [skillsList, artifactsList] = await Promise.all([
        api.listSkills(),
        api.listArtifacts()
      ]);
      setSkills(skillsList);
      setArtifacts(artifactsList);
      if (artifactsList.length > 0 && !selectedArtifact) {
        setSelectedArtifact(artifactsList[0]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleSkill = async (skillId: string, currentActiveState?: boolean) => {
    const nextState = currentActiveState === false;
    // Optimistic UI update
    setSkills(prev => prev.map(s => s.id === skillId ? { ...s, isActive: nextState } : s));
    try {
      await api.toggleSkill(skillId, nextState);
    } catch (err: any) {
      alert(`Erro ao alterar estado da skill: ${err.message}`);
      loadData();
    }
  };

  const handleSaveNewSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim() || !newSkillPrompt.trim()) return;

    try {
      await api.saveSkill({
        name: newSkillName,
        category: newSkillCategory,
        agentAssigned: newSkillAgent,
        description: newSkillDesc,
        promptInstructions: newSkillPrompt,
        isProjectSpecific: newSkillIsProjectSpecific,
        isActive: true
      });
      setIsCreatingSkill(false);
      setNewSkillName('');
      setNewSkillDesc('');
      setNewSkillPrompt('');
      loadData();
    } catch (err: any) {
      alert(`Erro ao criar skill: ${err.message}`);
    }
  };

  const handleDeleteSkill = async (id: string, isProjectSpecific?: boolean) => {
    if (!confirm('Deseja remover esta skill?')) return;
    try {
      await api.deleteSkill(id, isProjectSpecific);
      loadData();
    } catch (err: any) {
      alert(`Erro ao deletar: ${err.message}`);
    }
  };

  const handleSaveNewArtifact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArtTitle.trim() || !newArtContent.trim()) return;

    try {
      const saved = await api.saveArtifact({
        title: newArtTitle,
        content: newArtContent,
        type: newArtType,
        filename: newArtFilename.trim() || undefined,
        isGlobal: newArtIsGlobal
      });
      setIsCreatingArtifact(false);
      setNewArtTitle('');
      setNewArtFilename('');
      setNewArtContent('');
      await loadData();
      setSelectedArtifact(saved);
    } catch (err: any) {
      alert(`Erro ao criar artefato: ${err.message}`);
    }
  };

  const handleDeleteArtifact = async (filename: string, isGlobal?: boolean) => {
    if (!confirm(`Deseja remover o artefato "${filename}"?`)) return;
    try {
      await api.deleteArtifact(filename, isGlobal);
      if (selectedArtifact?.filename === filename) {
        setSelectedArtifact(null);
      }
      loadData();
    } catch (err: any) {
      alert(`Erro ao excluir artefato: ${err.message}`);
    }
  };

  const copyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredSkills = skills.filter(s => {
    // 1. Scope filter
    if (skillScopeFilter === 'global' && s.isProjectSpecific) return false;
    if (skillScopeFilter === 'project' && !s.isProjectSpecific) return false;

    // 2. Category filter
    if (selectedCategoryFilter !== 'all' && s.category !== selectedCategoryFilter) return false;

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const categories = ['all', 'Architecture', 'Debugging', 'Security', 'Frontend', 'Backend', 'Testing', 'Custom'];

  return (
    <div className="h-full flex flex-col bg-background text-slate-200 overflow-hidden font-sans">
      {/* Top Bar Tabs */}
      <div className="h-12 border-b border-card-border bg-sidebar px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center space-x-2 bg-card rounded-lg p-0.5 border border-card-border text-xs">
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'skills'
                ? 'bg-accent text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-light" />
            <span>Skills dos Agentes ({skills.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('artifacts')}
            className={`px-3 py-1 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'artifacts'
                ? 'bg-accent text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-brand-emerald" />
            <span>Artefatos & Blueprints ({artifacts.length})</span>
          </button>
        </div>

        {activeTab === 'skills' ? (
          <button
            onClick={() => setIsCreatingSkill(true)}
            className="px-3 py-1 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center space-x-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Skill</span>
          </button>
        ) : (
          <button
            onClick={() => setIsCreatingArtifact(true)}
            className="px-3 py-1 rounded-lg bg-brand-emerald hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center space-x-1 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-slate-950" />
            <span>Novo Artefato</span>
          </button>
        )}
      </div>

      {/* TAB 1: SKILLS MANAGEMENT */}
      {activeTab === 'skills' && (
        <div className="flex-1 flex flex-col p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-card-border space-y-4">
          {/* Header Controls: Scope Filter, Category Filter, Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-card-border">
            {/* Scope Selector: All vs Global vs Project */}
            <div className="flex items-center space-x-1 bg-panel p-1 rounded-xl border border-card-border text-xs">
              <button
                onClick={() => setSkillScopeFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 ${
                  skillScopeFilter === 'all'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Todas as Skills</span>
                <span className="text-[10px] opacity-75">({skills.length})</span>
              </button>
              <button
                onClick={() => setSkillScopeFilter('global')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 ${
                  skillScopeFilter === 'global'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Skills padrão herdadas por todos os projetos"
              >
                <Globe className="w-3 h-3 text-cyan-400" />
                <span>🌐 Globais Padrão</span>
                <span className="text-[10px] opacity-75">
                  ({skills.filter(s => !s.isProjectSpecific).length})
                </span>
              </button>
              <button
                onClick={() => setSkillScopeFilter('project')}
                className={`px-2.5 py-1 rounded-lg transition-all font-medium flex items-center space-x-1.5 ${
                  skillScopeFilter === 'project'
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Skills criadas exclusivamente para este projeto"
              >
                <FolderGit2 className="w-3 h-3 text-amber-400" />
                <span>📁 Deste Projeto</span>
                <span className="text-[10px] opacity-75">
                  ({skills.filter(s => s.isProjectSpecific).length})
                </span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar skill por nome ou instrução..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-panel border border-card-border text-xs text-slate-200 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mr-1">Categoria:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedCategoryFilter === cat
                    ? 'bg-accent/20 border border-accent text-accent-light'
                    : 'bg-card border border-card-border text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>

          {/* New Skill Modal / Inline Form */}
          {isCreatingSkill && (
            <form
              onSubmit={handleSaveNewSkill}
              className="p-4 rounded-2xl bg-card border-2 border-accent/40 shadow-xl space-y-3.5 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-card-border pb-2">
                <span className="font-bold text-xs text-slate-100 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-accent-light" />
                  <span>Cadastrar Nova Skill para o Tellus</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingSkill(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
              </div>

              {/* Scope Selector in Form */}
              <div className="p-2.5 rounded-xl bg-panel border border-card-border flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Escopo da Skill</span>
                  <span className="text-[11px] text-slate-400">
                    {newSkillIsProjectSpecific
                      ? 'Salvar no projeto atual (.agentic/skills/) — aplicável somente a este projeto.'
                      : 'Salvar globalmente (~/.tellus/skills/) — padrão e herdada por todos os projetos.'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 bg-card p-1 rounded-lg border border-card-border text-xs">
                  <button
                    type="button"
                    onClick={() => setNewSkillIsProjectSpecific(false)}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center space-x-1 ${
                      !newSkillIsProjectSpecific ? 'bg-accent text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <Globe className="w-3 h-3 text-cyan-300" />
                    <span>Global (Todos)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSkillIsProjectSpecific(true)}
                    className={`px-2.5 py-1 rounded-md transition-all font-medium flex items-center space-x-1 ${
                      newSkillIsProjectSpecific ? 'bg-accent text-white shadow-sm' : 'text-slate-400'
                    }`}
                  >
                    <FolderGit2 className="w-3 h-3 text-amber-300" />
                    <span>Apenas este Projeto</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Nome da Skill</label>
                  <input
                    type="text"
                    required
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Ex: Refactoring & Clean Code"
                    className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Categoria</label>
                  <select
                    value={newSkillCategory}
                    onChange={(e) => setNewSkillCategory(e.target.value)}
                    className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                  >
                    <option value="Architecture">Architecture</option>
                    <option value="Debugging">Debugging</option>
                    <option value="Security">Security</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Backend">Backend</option>
                    <option value="Testing">Testing</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">Agente Destinado</label>
                  <select
                    value={newSkillAgent}
                    onChange={(e) => setNewSkillAgent(e.target.value)}
                    className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                  >
                    <option value="all">Todos os Agentes</option>
                    <option value="architect">Architect & Planner</option>
                    <option value="debugger">Deep Debugger</option>
                    <option value="fast_coder">Fast Coder</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Descrição Curta</label>
                <input
                  type="text"
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  placeholder="Quando esta skill deve ser ativada e o que ela resolve..."
                  className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Instruções de Sistema & Prompt da Skill</label>
                <textarea
                  rows={3}
                  required
                  value={newSkillPrompt}
                  onChange={(e) => setNewSkillPrompt(e.target.value)}
                  placeholder="Diretrizes e melhores práticas que o agente deve seguir ao executar esta skill..."
                  className="w-full bg-panel border border-card-border rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm"
                >
                  Salvar Skill
                </button>
              </div>
            </form>
          )}

          {/* Skills Grid */}
          <div className="grid grid-cols-2 gap-3">
            {filteredSkills.length === 0 ? (
              <div className="col-span-2 p-8 text-center bg-card border border-card-border rounded-2xl text-slate-500 text-xs">
                Nenhuma skill encontrada com os filtros atuais.
              </div>
            ) : (
              filteredSkills.map((skill) => {
                const isActive = skill.isActive !== false;
                return (
                  <div
                    key={skill.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                      isActive
                        ? 'bg-card border-card-border hover:border-accent/40 shadow-sm'
                        : 'bg-panel/60 border-card-border/40 opacity-70'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-100 flex items-center space-x-1.5 truncate max-w-[220px]">
                          <Sparkles className={`w-3.5 h-3.5 ${isActive ? 'text-accent-light' : 'text-slate-500'}`} />
                          <span className="truncate">{skill.name}</span>
                        </span>

                        {/* Scope Badge */}
                        <div className="flex items-center space-x-1.5">
                          {skill.isProjectSpecific ? (
                            <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                              <FolderGit2 className="w-2.5 h-2.5" />
                              <span>Projeto</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center space-x-1">
                              <Globe className="w-2.5 h-2.5" />
                              <span>Global Padrão</span>
                            </span>
                          )}

                          {/* Active / Inactive Toggle Switch */}
                          <button
                            onClick={() => handleToggleSkill(skill.id, skill.isActive)}
                            className={`p-1 rounded-lg border transition-all flex items-center space-x-1 text-[10px] font-semibold ${
                              isActive
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                                : 'bg-rose-950/30 border-rose-500/30 text-rose-400 hover:bg-rose-900/40'
                            }`}
                            title={isActive ? 'Desativar skill no projeto atual' : 'Ativar skill no projeto atual'}
                          >
                            {isActive ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-400" />
                                <span>Ativa</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-slate-500" />
                                <span>Inativa</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {skill.description}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-panel border border-card-border/60 text-[10px] font-mono text-slate-300 line-clamp-3">
                      {skill.promptInstructions}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-card-border/50 text-[10px] text-slate-500">
                      <span>Categoria: <strong className="text-slate-300 font-medium">{skill.category}</strong></span>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => copyContent(skill.promptInstructions, skill.id)}
                          className="p-1 rounded hover:bg-card-border text-slate-400 hover:text-slate-200 transition-colors"
                          title="Copiar prompt da skill"
                        >
                          {copiedId === skill.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => handleDeleteSkill(skill.id, skill.isProjectSpecific)}
                          className="p-1 rounded hover:bg-card-border text-slate-500 hover:text-rose-400 transition-colors"
                          title="Excluir skill"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ARTIFACTS GALLERY & BLUEPRINTS */}
      {activeTab === 'artifacts' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Artifacts List Sidebar */}
          <div className="w-80 border-r border-card-border bg-sidebar flex flex-col shrink-0">
            <div className="p-3 border-b border-card-border flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-slate-400 font-mono flex items-center space-x-1.5">
                <FileCheck className="w-3.5 h-3.5 text-brand-emerald" />
                <span>Artefatos & Blueprints</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel border border-card-border text-slate-400">
                {artifacts.length}
              </span>
            </div>

            {/* Create Artifact Inline Panel */}
            {isCreatingArtifact && (
              <form
                onSubmit={handleSaveNewArtifact}
                className="p-3 border-b border-card-border bg-card space-y-2 text-xs animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100">Novo Artefato</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingArtifact(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <input
                  type="text"
                  required
                  placeholder="Título do Artefato..."
                  value={newArtTitle}
                  onChange={(e) => setNewArtTitle(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-accent"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newArtType}
                    onChange={(e: any) => setNewArtType(e.target.value)}
                    className="w-full bg-panel border border-card-border rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-accent"
                  >
                    <option value="plan">Plan / Blueprint</option>
                    <option value="walkthrough">Walkthrough</option>
                    <option value="report">Report / Spec</option>
                    <option value="diagram">Diagram</option>
                    <option value="code">Code Snippet</option>
                  </select>

                  <select
                    value={newArtIsGlobal ? 'global' : 'project'}
                    onChange={(e) => setNewArtIsGlobal(e.target.value === 'global')}
                    className="w-full bg-panel border border-card-border rounded-lg px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-accent"
                  >
                    <option value="project">📁 Deste Projeto</option>
                    <option value="global">🌐 Template Global</option>
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Nome do arquivo (ex: architecture_spec.md)"
                  value={newArtFilename}
                  onChange={(e) => setNewArtFilename(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-accent"
                />

                <textarea
                  rows={4}
                  required
                  placeholder="# Conteúdo Markdown do artefato..."
                  value={newArtContent}
                  onChange={(e) => setNewArtContent(e.target.value)}
                  className="w-full bg-panel border border-card-border rounded-lg p-2 text-[11px] font-mono text-slate-100 focus:outline-none focus:border-accent"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm"
                  >
                    Salvar Artefato
                  </button>
                </div>
              </form>
            )}

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-card-border">
              {artifacts.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  Nenhum artefato gerado ainda. Crie um novo artefato ou peça ao Tellus no chat para gerar um plano!
                </div>
              ) : (
                artifacts.map((art) => {
                  const isActive = selectedArtifact?.filename === art.filename && selectedArtifact?.isGlobal === art.isGlobal;
                  return (
                    <div
                      key={`${art.isGlobal ? 'g' : 'p'}_${art.filename}`}
                      onClick={() => setSelectedArtifact(art)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col space-y-1.5 ${
                        isActive
                          ? 'bg-accent/15 border-accent text-white shadow-sm'
                          : 'bg-card border-card-border text-slate-300 hover:bg-card-border/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs truncate max-w-[170px] text-slate-100">
                          {art.title}
                        </span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-emerald/15 text-emerald-300 border border-emerald-500/30">
                          {art.type}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span className="truncate max-w-[180px]">{art.filename}</span>
                        {art.isGlobal ? (
                          <span className="text-cyan-400 font-bold">🌐 Global</span>
                        ) : (
                          <span className="text-amber-400 font-bold">📁 Projeto</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Artifact Preview & Content */}
          {selectedArtifact ? (
            <div className="flex-1 flex flex-col bg-background overflow-hidden">
              <div className="p-3 border-b border-card-border bg-sidebar flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-brand-emerald" />
                  <span className="font-bold text-xs text-slate-100">{selectedArtifact.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">({selectedArtifact.filename})</span>
                  {selectedArtifact.isGlobal && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                      Template Global
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyContent(selectedArtifact.content, selectedArtifact.id)}
                    className="px-2.5 py-1 rounded-lg bg-panel hover:bg-card-border border border-card-border text-xs text-slate-300 flex items-center space-x-1 transition-all"
                    title="Copiar Markdown"
                  >
                    {copiedId === selectedArtifact.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Markdown</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDeleteArtifact(selectedArtifact.filename, selectedArtifact.isGlobal)}
                    className="p-1 rounded-lg hover:bg-rose-950/40 border border-transparent hover:border-rose-500/30 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Excluir artefato"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-panel/30 scrollbar-thin scrollbar-thumb-card-border">
                <div className="prose prose-invert prose-xs max-w-none text-xs leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedArtifact.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
              <FileCheck className="w-8 h-8 opacity-40 text-brand-emerald" />
              <span>Selecione um artefato para visualizar os detalhes.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
