import { GoogleGenAI } from '@google/genai';
import type {
  AIAnswerDetail,
  AIModelInfo,
  AIProviderInfo,
  AIUsageMetadata,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  TestAIConnectionResult
} from '../../../../shared/ai';
import { GeminiSecretStore } from '../../secrets/gemini-secret-store';
import { InterviewResponseEngine } from '../../interview/response-engine';
import type { AIProvider } from '../types';

const MODEL_INFO_CACHE_MS = 60_000;
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const FALLBACK_GEMINI_MODELS: AIModelInfo[] = [
  { name: 'gemini-3.5-flash-lite', parameterSize: 'Fast / low cost' },
  { name: 'gemini-3.7-flash', parameterSize: 'Latest Flash' },
  { name: 'gemini-3.6-flash', parameterSize: 'Balanced Flash' },
  { name: 'gemini-3.5-flash', parameterSize: 'Strong Flash' },
  { name: 'gemini-3.1-flash-lite', parameterSize: 'Cost-efficient' }
];

interface GeminiModel {
  name?: string;
  displayName?: string;
  supportedActions?: string[];
}

interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiResponseChunk {
  text?: string;
  usageMetadata?: GeminiUsage;
}

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  private readonly responseEngine = new InterviewResponseEngine();
  private cachedInfo: { value: AIProviderInfo; expiresAt: number } | null = null;

  constructor(private readonly secretStore: GeminiSecretStore) {}

  async getInfo(): Promise<AIProviderInfo> {
    const apiKey = await this.secretStore.getApiKey();

    if (!apiKey) {
      return {
        id: this.id,
        name: this.name,
        status: 'not-configured',
        message: 'Gemini API key is not saved yet.',
        setupHint: 'Open Settings, select Google Gemini, enter your Gemini API key, and save it locally.',
        models: FALLBACK_GEMINI_MODELS
      };
    }

    if (this.cachedInfo && Date.now() < this.cachedInfo.expiresAt) {
      return this.cachedInfo.value;
    }

    try {
      const models = await this.listModels(apiKey);

      return this.cacheInfo({
        id: this.id,
        name: this.name,
        status: 'available',
        message: `${models.length} Gemini model${models.length === 1 ? '' : 's'} available.`,
        models
      });
    } catch (error) {
      const mappedError = mapGeminiError(error);

      return {
        id: this.id,
        name: this.name,
        status: 'error',
        message: mappedError.message,
        setupHint: mappedError.setupHint,
        models: FALLBACK_GEMINI_MODELS
      };
    }
  }

  async testConnection(): Promise<TestAIConnectionResult> {
    const apiKey = await this.secretStore.getApiKey();

    if (!apiKey) {
      const provider = await this.getInfo();

      return {
        ok: false,
        provider,
        message: provider.message
      };
    }

    try {
      const ai = createGeminiClient(apiKey);
      const response = await ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
        contents: 'Reply with OK.',
        config: {
          maxOutputTokens: 8,
          temperature: 0
        }
      });
      const text = response.text?.trim() ?? '';
      const provider = await this.getInfo();

      return {
        ok: Boolean(text),
        provider,
        message: text ? 'Gemini connection is working.' : 'Gemini responded without text.'
      };
    } catch (error) {
      const mappedError = mapGeminiError(error);

      return {
        ok: false,
        provider: {
          id: this.id,
          name: this.name,
          status: 'error',
          message: mappedError.message,
          setupHint: mappedError.setupHint,
          models: FALLBACK_GEMINI_MODELS
        },
        message: mappedError.message
      };
    }
  }

  async generateAnswer(request: GenerateAnswerRequest, onToken?: (token: string) => void): Promise<GenerateAnswerResult> {
    const provider = await this.getInfo();
    const apiKey = await this.secretStore.getApiKey();

    if (!apiKey) {
      return {
        ok: false,
        provider,
        error: 'Gemini API key is not saved yet.',
        setupHint: provider.setupHint
      };
    }

    const model = request.model || provider.models?.[0]?.name || DEFAULT_GEMINI_MODEL;

    try {
      const promptResult = this.responseEngine.buildPrompt(request);
      const ai = createGeminiClient(apiKey);
      const stream = await ai.models.generateContentStream({
        model,
        contents: promptResult.prompt,
        config: {
          maxOutputTokens: getTokenLimit(request.maxAnswerLength ?? request.detail),
          temperature: normalizeTemperature(request.temperature)
        }
      });
      let answer = '';
      let usage: AIUsageMetadata | undefined;

      for await (const chunk of stream as AsyncGenerator<GeminiResponseChunk>) {
        if (chunk.usageMetadata) {
          usage = mapUsage(chunk.usageMetadata);
        }

        const token = chunk.text ?? '';

        if (!token) {
          continue;
        }

        answer += token;
        onToken?.(token);
      }

      const trimmedAnswer = answer.trim();

      if (!trimmedAnswer) {
        throw new Error('Gemini responded without answer text.');
      }

      const followUpQuestions = this.responseEngine.predictFollowUpQuestions({
        question: request.question,
        answer: trimmedAnswer,
        category: promptResult.category,
        request
      });

      return {
        ok: true,
        provider,
        answer: trimmedAnswer,
        category: promptResult.category,
        followUpQuestions,
        usage
      };
    } catch (error) {
      const mappedError = mapGeminiError(error);

      return {
        ok: false,
        provider: {
          ...provider,
          status: 'error',
          message: mappedError.message
        },
        error: mappedError.message,
        setupHint: mappedError.setupHint
      };
    }
  }

  private async listModels(apiKey: string): Promise<AIModelInfo[]> {
    const ai = createGeminiClient(apiKey);
    const pager = await ai.models.list({
      config: {
        pageSize: 50
      }
    });
    const listedModels: AIModelInfo[] = [];

    for await (const model of pager as AsyncIterable<GeminiModel>) {
      const modelName = normalizeModelName(model.name);

      if (!isTextGenerationGeminiModel(modelName, model.supportedActions)) {
        continue;
      }

      listedModels.push({
        name: modelName,
        parameterSize: model.displayName
      });
    }

    return orderModels(listedModels);
  }

  private cacheInfo(info: AIProviderInfo): AIProviderInfo {
    this.cachedInfo = {
      value: info,
      expiresAt: Date.now() + MODEL_INFO_CACHE_MS
    };

    return info;
  }
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

function normalizeModelName(name: string | undefined): string {
  return (name ?? '').replace(/^models\//, '').trim();
}

function isTextGenerationGeminiModel(name: string, supportedActions: string[] | undefined): boolean {
  if (!name.startsWith('gemini-')) {
    return false;
  }

  if (name.includes('embedding') || name.includes('image') || name.includes('tts') || name.includes('live')) {
    return false;
  }

  if (!supportedActions?.length) {
    return true;
  }

  return supportedActions.includes('generateContent');
}

function orderModels(models: AIModelInfo[]): AIModelInfo[] {
  const byName = new Map(models.map((model) => [model.name, model]));
  const orderedModels = FALLBACK_GEMINI_MODELS.map((model) => byName.get(model.name) ?? model);
  const remainingModels = models
    .filter((model) => !orderedModels.some((orderedModel) => orderedModel.name === model.name))
    .sort((left, right) => left.name.localeCompare(right.name));

  return [...orderedModels, ...remainingModels];
}

function normalizeTemperature(temperature: number | undefined): number {
  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return 0.3;
  }

  return Math.min(Math.max(temperature, 0), 1);
}

function getTokenLimit(detail: AIAnswerDetail): number {
  if (detail === 'short') {
    return 120;
  }

  if (detail === 'expanded') {
    return 420;
  }

  return 260;
}

function mapUsage(usage: GeminiUsage): AIUsageMetadata | undefined {
  const mappedUsage: AIUsageMetadata = {
    inputTokens: usage.promptTokenCount,
    outputTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount
  };

  return Object.values(mappedUsage).some((value) => typeof value === 'number') ? mappedUsage : undefined;
}

function mapGeminiError(error: unknown): { message: string; setupHint: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const message = rawMessage.toLowerCase();

  if (message.includes('api key') || message.includes('apikey') || message.includes('unauth') || message.includes('permission')) {
    return {
      message: 'Gemini API key is invalid or does not have access.',
      setupHint: 'Check the saved Gemini API key in Settings, then test the connection again.'
    };
  }

  if (message.includes('quota') || message.includes('billing')) {
    return {
      message: 'Gemini quota or billing limit was reached.',
      setupHint: 'Check quota/billing for the Gemini API key, or switch back to Ollama.'
    };
  }

  if (message.includes('429') || message.includes('rate')) {
    return {
      message: 'Gemini is rate limited right now.',
      setupHint: 'Wait a moment, choose a smaller model, or switch back to Ollama.'
    };
  }

  if (message.includes('404') || message.includes('not found') || message.includes('model')) {
    return {
      message: 'Selected Gemini model is unavailable.',
      setupHint: 'Choose another Gemini Flash model in Settings and try again.'
    };
  }

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('enotfound') ||
    message.includes('econn') ||
    message.includes('timeout')
  ) {
    return {
      message: 'Gemini network request failed.',
      setupHint: 'Check your internet connection, then test Gemini again.'
    };
  }

  return {
    message: 'Gemini API request failed.',
    setupHint: 'Try another Gemini model or switch back to Ollama if the issue continues.'
  };
}
