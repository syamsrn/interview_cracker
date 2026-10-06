import type {
  AIProviderId,
  AIProviderInfo,
  GenerateAnswerSuccess,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  TestAIConnectionResult
} from '../../../shared/ai';
import { GeminiSecretStore } from '../secrets/gemini-secret-store';
import { FutureProvider } from './providers/future-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { OllamaProvider } from './providers/ollama-provider';
import type { AIProvider } from './types';

const defaultProviderId: AIProviderId = 'ollama';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 25;

interface CachedAnswer {
  createdAt: number;
  result: GenerateAnswerSuccess;
}

export class AIService {
  private readonly providers = new Map<AIProviderId, AIProvider>();
  private readonly answerCache = new Map<string, CachedAnswer>();

  constructor(geminiSecretStore?: GeminiSecretStore) {
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new FutureProvider('openai', 'OpenAI'));
    this.registerProvider(geminiSecretStore ? new GeminiProvider(geminiSecretStore) : new FutureProvider('gemini', 'Gemini'));
    this.registerProvider(new FutureProvider('claude', 'Claude'));
  }

  async getDefaultProviderInfo(): Promise<AIProviderInfo> {
    return this.getProvider(defaultProviderId).getInfo();
  }

  async getProviderInfo(providerId: AIProviderId = defaultProviderId): Promise<AIProviderInfo> {
    const provider = this.providers.get(providerId);

    if (!provider) {
      return this.getDefaultProviderInfo();
    }

    return provider.getInfo();
  }

  async testConnection(providerId: AIProviderId = defaultProviderId): Promise<TestAIConnectionResult> {
    const provider = this.providers.get(providerId);

    if (!provider) {
      const defaultProvider = await this.getDefaultProviderInfo();

      return {
        ok: false,
        provider: defaultProvider,
        message: `Unknown AI provider: ${providerId}`
      };
    }

    return provider.testConnection();
  }

  async generateAnswer(request: GenerateAnswerRequest, onToken?: (token: string) => void): Promise<GenerateAnswerResult> {
    const providerId = request.providerId ?? defaultProviderId;
    const provider = this.providers.get(providerId);

    if (!provider) {
      const defaultProvider = await this.getDefaultProviderInfo();

      return {
        ok: false,
        provider: defaultProvider,
        error: `Unknown AI provider: ${providerId}`
      };
    }

    const cacheKey = createAnswerCacheKey({
      ...request,
      providerId
    });
    const cachedResult = this.getCachedAnswer(cacheKey);

    if (cachedResult) {
      onToken?.(cachedResult.answer);
      return cachedResult;
    }

    const result = await provider.generateAnswer(request, onToken);

    if (result.ok) {
      this.setCachedAnswer(cacheKey, result);
    }

    return result;
  }

  private registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  private getProvider(providerId: AIProviderId): AIProvider {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`AI provider is not registered: ${providerId}`);
    }

    return provider;
  }

  private getCachedAnswer(cacheKey: string): GenerateAnswerSuccess | null {
    const cachedAnswer = this.answerCache.get(cacheKey);

    if (!cachedAnswer) {
      return null;
    }

    if (Date.now() - cachedAnswer.createdAt > CACHE_TTL_MS) {
      this.answerCache.delete(cacheKey);
      return null;
    }

    this.answerCache.delete(cacheKey);
    this.answerCache.set(cacheKey, cachedAnswer);

    return cloneSuccessResult(cachedAnswer.result);
  }

  private setCachedAnswer(cacheKey: string, result: GenerateAnswerSuccess): void {
    this.answerCache.set(cacheKey, {
      createdAt: Date.now(),
      result: cloneSuccessResult(result)
    });

    while (this.answerCache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.answerCache.keys().next().value;

      if (!oldestKey) {
        break;
      }

      this.answerCache.delete(oldestKey);
    }
  }
}

function createAnswerCacheKey(request: GenerateAnswerRequest): string {
  const cacheableRequest = {
    question: request.question.trim(),
    detail: request.detail,
    providerId: request.providerId ?? defaultProviderId,
    model: request.model ?? '',
    temperature: request.temperature ?? null,
    maxAnswerLength: request.maxAnswerLength ?? request.detail,
    responseStyle: request.responseStyle ?? 'concise',
    conversationMemory: request.conversationMemory ?? [],
    personalKnowledge: request.personalKnowledge ?? [],
    resumeProfile: request.resumeProfile?.content ?? ''
  };

  return stableStringify(cacheableRequest);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function cloneSuccessResult(result: GenerateAnswerSuccess): GenerateAnswerSuccess {
  return {
    ...result,
    provider: {
      ...result.provider,
      models: result.provider.models?.map((model) => ({ ...model }))
    },
    followUpQuestions: [...result.followUpQuestions],
    usage: result.usage ? { ...result.usage } : undefined
  };
}
