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

    // Auto-resolve model prefix if user typed just model name (e.g. 'gpt-5.6-luna-pro' -> 'openai/gpt-5.6-luna-pro')
    let resolvedModel = model;
    if (!resolvedModel.includes('/')) {
      if (resolvedModel.startsWith('gpt-') || resolvedModel.startsWith('o1') || resolvedModel.startsWith('o3') || resolvedModel.startsWith('chatgpt')) {
        resolvedModel = `openai/${resolvedModel}`;
      } else if (resolvedModel.startsWith('claude')) {
        resolvedModel = `anthropic/${resolvedModel}`;
      } else if (resolvedModel.startsWith('gemini')) {
        resolvedModel = `google/${resolvedModel}`;
      } else if (resolvedModel.startsWith('deepseek')) {
        resolvedModel = `deepseek/${resolvedModel}`;
      } else if (resolvedModel.startsWith('llama')) {
        resolvedModel = `meta-llama/${resolvedModel}`;
      } else if (resolvedModel.startsWith('mistral') || resolvedModel.startsWith('mixtral')) {
        resolvedModel = `mistralai/${resolvedModel}`;
      } else if (resolvedModel.startsWith('grok')) {
        resolvedModel = `x-ai/${resolvedModel}`;
      }
    }

    // Determine active provider
    let activeProvider = provider;
    if (activeProvider === 'auto') {
      if ((resolvedModel.startsWith('google/') || resolvedModel.startsWith('gemini')) && config.keys.google) {
        activeProvider = 'google';
      } else if ((resolvedModel.startsWith('anthropic/') || resolvedModel.startsWith('claude')) && config.keys.anthropic) {
        activeProvider = 'anthropic';
      } else if ((resolvedModel.startsWith('openai/') || resolvedModel.startsWith('gpt-') || resolvedModel.startsWith('o1') || resolvedModel.startsWith('o3')) && config.keys.openai) {
        activeProvider = 'openai';
      } else {
        activeProvider = 'openrouter';
      }
    }

    if (activeProvider === 'google' && config.keys.google) {
      return GeminiService.streamChat(config.keys.google, resolvedModel, messages, tools, callbacks, abortSignal);
    } else if (activeProvider === 'anthropic' && config.keys.anthropic) {
      return AnthropicService.streamChat(config.keys.anthropic, resolvedModel, messages, tools, callbacks, abortSignal);
    } else if (activeProvider === 'openai' && config.keys.openai) {
      return OpenAIService.streamChat(config.keys.openai, resolvedModel, messages, tools, callbacks, abortSignal);
    } else {
      // Default to OpenRouter (Supports 400+ models including openai/gpt-5.6-luna-pro)
      const key = config.keys.openrouter;
      if (!key) {
        throw new Error('Chave da OpenRouter não configurada. Configure sua API key nas configurações da interface.');
      }
      return OpenRouterService.streamChat(key, resolvedModel, messages, tools, callbacks, abortSignal);
    }
  }
}
