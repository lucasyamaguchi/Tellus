import { ChatMessage, ToolDefinition } from './openrouter.js';

export class GeminiService {
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
      throw new Error('API Key do Google Gemini não configurada.');
    }

    const cleanModel = model.replace('google/', '').replace('gemini/', '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?alt=sse&key=${apiKey}`;

    // Convert OpenAI messages to Gemini contents format
    const contents: any[] = [];
    let systemInstruction: any = undefined;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content || '' }] };
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content || '' }]
        });
      } else if (msg.role === 'assistant') {
        const parts: any[] = [];
        if (msg.content) parts.push({ text: msg.content });
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            let args = {};
            try { args = JSON.parse(tc.function.arguments); } catch {}
            parts.push({
              functionCall: {
                name: tc.function.name,
                args
              }
            });
          }
        }
        contents.push({ role: 'model', parts });
      } else if (msg.role === 'tool') {
        let responseJson: any = { content: msg.content };
        try { responseJson = JSON.parse(msg.content || '{}'); } catch {}
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: msg.name || 'tool_result',
              response: responseJson
            }
          }]
        });
      }
    }

    const payload: any = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;

    if (tools && tools.length > 0) {
      payload.tools = [{
        functionDeclarations: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters
        }))
      }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abortSignal
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Gemini Error (${response.status}): ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Não foi possível inicializar streaming do Gemini.');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';
    const toolCalls: any[] = [];

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
          const data = JSON.parse(jsonStr);
          const candidate = data.candidates?.[0];
          if (!candidate) continue;

          for (const part of candidate.content?.parts || []) {
            if (part.text) {
              fullContent += part.text;
              callbacks.onContentChunk(part.text);
            }
            if (part.functionCall) {
              const tc = {
                id: `call_${Math.random().toString(36).substring(2, 9)}`,
                type: 'function' as const,
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args || {})
                }
              };
              toolCalls.push(tc);
            }
          }
        } catch {
          // ignore parse chunk error
        }
      }
    }

    if (toolCalls.length > 0) {
      callbacks.onToolCalls(toolCalls);
    }

    return { fullContent, fullReasoning, toolCalls };
  }
}
