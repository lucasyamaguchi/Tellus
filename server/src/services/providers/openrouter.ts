import axios from 'axios';

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
    const res = await axios.get(`${this.baseUrl}/models`, { headers, timeout: 15000 });
    return res.data.data || [];
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

    const payload: any = {
      model,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Agentic IDE Local'
      },
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível inicializar o streaming de resposta.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    const activeToolCalls: Record<number, { id: string; name: string; arguments: string }> = {};

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
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!activeToolCalls[idx]) {
                activeToolCalls[idx] = {
                  id: tc.id || `call_${Math.random().toString(36).substring(2, 9)}`,
                  name: tc.function?.name || '',
                  arguments: ''
                };
              }
              if (tc.function?.name) {
                activeToolCalls[idx].name = tc.function.name;
              }
              if (tc.function?.arguments) {
                activeToolCalls[idx].arguments += tc.function.arguments;
              }
            }
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }

    const finalToolCalls = Object.values(activeToolCalls).map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.name,
        arguments: tc.arguments
      }
    }));

    if (finalToolCalls.length > 0) {
      callbacks.onToolCalls(finalToolCalls);
    }

    return { fullContent, fullReasoning, toolCalls: finalToolCalls };
  }
}
