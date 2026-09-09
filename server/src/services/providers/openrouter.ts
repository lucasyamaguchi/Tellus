export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export class OpenRouterService {
  private static baseUrl = 'https://openrouter.ai/api/v1';

  public static async listModels(apiKey?: string): Promise<OpenRouterModel[]> {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch(`${this.baseUrl}/models`, { headers });
    if (!res.ok) {
      throw new Error(`Falha ao listar modelos da OpenRouter: ${res.statusText}`);
    }
    const data = (await res.json()) as any;
    const rawList: OpenRouterModel[] = data.data || [];
    // Filter out asynchronous batch models that only work with offline Batch API
    return rawList.filter(m => !m.id.endsWith(':batch') && !m.id.includes(':batch'));
  }

  public static async getCredits(apiKey: string): Promise<{ totalCredits: number; totalUsage: number; remainingCredits: number }> {
    if (!apiKey) {
      throw new Error('Chave de API OpenRouter não informada');
    }
    try {
      const res = await fetch(`${this.baseUrl}/credits`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (res.ok) {
        const json = (await res.json()) as any;
        const data = json.data || {};
        const totalCredits = typeof data.total_credits === 'number' ? data.total_credits : 0;
        const totalUsage = typeof data.total_usage === 'number' ? data.total_usage : 0;
        const remainingCredits = Math.max(0, totalCredits - totalUsage);
        return { totalCredits, totalUsage, remainingCredits };
      }
    } catch {
      // fallback
    }

    // Fallback to /auth/key endpoint
    try {
      const keyRes = await fetch(`${this.baseUrl}/auth/key`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (keyRes.ok) {
        const keyJson = (await keyRes.json()) as any;
        const keyData = keyJson.data || {};
        const limit = keyData.limit || 0;
        const usage = keyData.usage || 0;
        const remaining = keyData.limit_remaining !== undefined ? keyData.limit_remaining : Math.max(0, limit - usage);
        return { totalCredits: limit, totalUsage: usage, remainingCredits: remaining };
      }
      throw new Error(`Erro na API OpenRouter: status ${keyRes.status}`);
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao consultar saldo da OpenRouter');
    }
  }

  public static async streamChat(
    apiKey: string,
    model: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: {
      onContentChunk: (chunk: string) => void;
      onReasoningChunk: (chunk: string) => void;
      onToolCalls: (toolCalls: any[]) => void;
    },
    abortSignal?: AbortSignal
  ): Promise<{ fullContent: string; fullReasoning: string; toolCalls: any[] }> {
    if (!apiKey) {
      throw new Error('API Key da OpenRouter não configurada. Por favor, adicione sua chave nas configurações.');
    }

    // Strip :batch suffix if entered, fallback to interactive chat endpoint
    const cleanModel = model.replace(/:batch$/i, '').trim();

    const payload: any = {
      model: cleanModel,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Tellus Agentic IDE'
        },
        body: JSON.stringify(payload),
        signal: abortSignal
      });
    } catch (fetchErr: any) {
      if (abortSignal?.aborted) {
        throw new Error('Requisição cancelada pelo usuário.');
      }
      throw fetchErr;
    }

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = `OpenRouter Error (${response.status}): ${errText}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          errorMsg = `OpenRouter (${response.status}): ${parsed.error.message}`;
        }
      } catch {
        // use raw
      }
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível inicializar o streaming de resposta.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    const activeToolCalls: Record<number, { id: string; name: string; arguments: string }> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          if (trimmed === 'data: [DONE]') continue;

          try {
            const jsonStr = trimmed.replace(/^data:\s*/, '');
            const data = JSON.parse(jsonStr);
            const choice = data.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            if (!delta) continue;

            // Check for reasoning or thought tokens
            if (delta.reasoning || delta.thought) {
              const rChunk = delta.reasoning || delta.thought;
              fullReasoning += rChunk;
              callbacks.onReasoningChunk(rChunk);
            }

            // Check for content tokens
            if (delta.content) {
              fullContent += delta.content;
              callbacks.onContentChunk(delta.content);
            }

            // Check for tool calls
            if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const index = tc.index || 0;
                if (!activeToolCalls[index]) {
                  activeToolCalls[index] = {
                    id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || ''
                  };
                } else {
                  if (tc.function?.name) activeToolCalls[index].name += tc.function.name;
                  if (tc.function?.arguments) activeToolCalls[index].arguments += tc.function.arguments;
                }
              }
            }
          } catch {
            // ignore malformed SSE line
          }
        }
      }
    } catch (readErr: any) {
      if (abortSignal?.aborted) {
        throw new Error('Requisição cancelada pelo usuário.');
      }
      if (!fullContent && !fullReasoning && Object.keys(activeToolCalls).length === 0) {
        throw new Error(`Conexão com provedor interrompida: ${readErr.message || 'Stream abortado'}`);
      }
    }

    const formattedToolCalls = Object.values(activeToolCalls).map(tc => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: tc.arguments
      }
    }));

    if (formattedToolCalls.length > 0) {
      callbacks.onToolCalls(formattedToolCalls);
    }

    return {
      fullContent,
      fullReasoning,
      toolCalls: formattedToolCalls
    };
  }
}
