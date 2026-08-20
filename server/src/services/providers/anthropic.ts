import { ChatMessage, ToolDefinition } from './openrouter.js';

export class AnthropicService {
  private static baseUrl = 'https://api.anthropic.com/v1';

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
      throw new Error('API Key da Anthropic não configurada.');
    }

    const cleanModel = model.replace('anthropic/', '');
    let system = '';
    const anthropicMessages: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n\n' : '') + (msg.content || '');
      } else if (msg.role === 'user') {
        anthropicMessages.push({ role: 'user', content: msg.content || '' });
      } else if (msg.role === 'assistant') {
        const contentBlocks: any[] = [];
        if (msg.content) contentBlocks.push({ type: 'text', text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            let input = {};
            try { input = JSON.parse(tc.function.arguments); } catch {}
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input
            });
          }
        }
        anthropicMessages.push({ role: 'assistant', content: contentBlocks });
      } else if (msg.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.tool_call_id,
              content: msg.content || ''
            }
          ]
        });
      }
    }

    const payload: any = {
      model: cleanModel,
      max_tokens: 4096,
      messages: anthropicMessages,
      stream: true
    };

    if (system) payload.system = system;
    if (tools && tools.length > 0) {
      payload.tools = tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
      }));
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível ler resposta da Anthropic.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    const toolCalls: any[] = [];
    let currentToolCall: any = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        try {
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          const event = JSON.parse(jsonStr);

          if (event.type === 'content_block_start') {
            if (event.content_block?.type === 'tool_use') {
              currentToolCall = {
                id: event.content_block.id,
                type: 'function' as const,
                function: {
                  name: event.content_block.name,
                  arguments: ''
                }
              };
            } else if (event.content_block?.type === 'thinking') {
              // start of thinking
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'text_delta') {
              fullContent += event.delta.text;
              callbacks.onContentChunk(event.delta.text);
            } else if (event.delta?.type === 'thinking_delta') {
              fullReasoning += event.delta.thinking;
              callbacks.onReasoningChunk(event.delta.thinking);
            } else if (event.delta?.type === 'input_json_delta') {
              if (currentToolCall) {
                currentToolCall.function.arguments += event.delta.partial_json;
              }
            }
          } else if (event.type === 'content_block_stop') {
            if (currentToolCall) {
              toolCalls.push(currentToolCall);
              currentToolCall = null;
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (toolCalls.length > 0) {
      callbacks.onToolCalls(toolCalls);
    }

    return { fullContent, fullReasoning, toolCalls };
  }
}
