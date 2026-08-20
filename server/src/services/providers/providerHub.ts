import { ConfigManager } from '../configManager.js';
import { OpenRouterService, ChatMessage, ToolDefinition } from './openrouter.js';
import { GeminiService } from './gemini.js';
import { AnthropicService } from './anthropic.js';
import { OpenAIService } from './openai.js';

export class ProviderHub {
  public static async streamChat(
    provider: 'openrouter' | 'google' | 'anthropic' | 'openai' | 'auto',
    model: string,
    messages: ChatMessage[],
    tools: ToolDefinition[],
    callbacks: {
      onContentChunk: (chunk: string) => void;
      onReasoningChunk: (chunk: string) => void;
      onToolCalls: (toolCalls: any[]) => void;
    },
    abortSignal?: AbortSignal
  ) {
    const config = ConfigManager.getConfig();

    // Determine actual provider
    let activeProvider = provider;
    if (activeProvider === 'auto') {
      if (model.startsWith('google/') || model.startsWith('gemini')) {
        activeProvider = config.keys.google ? 'google' : 'openrouter';
      } else if (model.startsWith('anthropic/') || model.startsWith('claude')) {
        activeProvider = config.keys.anthropic ? 'anthropic' : 'openrouter';
      } else if (model.startsWith('openai/') || model.startsWith('gpt-') || model.startsWith('o1') || model.startsWith('o3')) {
        activeProvider = config.keys.openai ? 'openai' : 'openrouter';
      } else {
        activeProvider = 'openrouter';
      }
    }

    if (activeProvider === 'google' && config.keys.google) {
      return GeminiService.streamChat(config.keys.google, model, messages, tools, callbacks, abortSignal);
    } else if (activeProvider === 'anthropic' && config.keys.anthropic) {
      return AnthropicService.streamChat(config.keys.anthropic, model, messages, tools, callbacks, abortSignal);
    } else if (activeProvider === 'openai' && config.keys.openai) {
      return OpenAIService.streamChat(config.keys.openai, model, messages, tools, callbacks, abortSignal);
    } else {
      // Default to OpenRouter
      const key = config.keys.openrouter;
      if (!key) {
        throw new Error('Chave da OpenRouter não configurada. Configure sua API key nas configurações da interface.');
      }
      return OpenRouterService.streamChat(key, model, messages, tools, callbacks, abortSignal);
    }
  }
}
