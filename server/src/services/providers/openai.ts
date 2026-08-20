import { ChatMessage, ToolDefinition } from './openrouter.js';

export class OpenAIService {
  private static baseUrl = 'https://api.openai.com/v1';

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
      throw new Error('API Key da OpenAI não configurada.');
    }

    const cleanModel = model.replace('openai/', '');
    const payload: any = {
      model: cleanModel,
      messages,
      stream: true
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível ler resposta da OpenAI.');

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

          if (delta.reasoning_content || delta.reasoning) {
            const r = delta.reasoning_content || delta.reasoning;
            fullReasoning += r;
            callbacks.onReasoningChunk(r);
          }

          if (delta.content) {
            fullContent += delta.content;
            callbacks.onContentChunk(delta.content);
          }

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
          // ignore
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
