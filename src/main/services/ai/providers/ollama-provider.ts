import type {
  AIAnswerDetail,
  AIModelInfo,
  AIProviderInfo,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  InterviewQuestionCategory,
  TestAIConnectionResult
} from '../../../../shared/ai';
import { InterviewResponseEngine } from '../../interview/response-engine';
import type { AIProvider } from '../types';

const OLLAMA_API_BASE_URL = 'http://localhost:11434/api';
const REQUEST_TIMEOUT_MS = 3000;
const MODEL_INFO_CACHE_MS = 30000;

const setupHint = [
  'Local AI not configured.',
  '',
  'Install Ollama for Windows, start it, then download a small model.',
  '',
  'Recommended CPU-friendly models for this machine:',
  '- llama3.2:3b',
  '- gemma3:4b',
  '- qwen2.5:3b',
  '',
  'Example:',
  'ollama pull llama3.2:3b'
].join('\n');

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
    modified_at?: string;
    size?: number;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

interface OllamaGenerateChunk {
  response?: string;
  done?: boolean;
  error?: string;
}

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  private readonly responseEngine = new InterviewResponseEngine();
  private cachedInfo: { value: AIProviderInfo; expiresAt: number } | null = null;

  async getInfo(): Promise<AIProviderInfo> {
    if (this.cachedInfo && Date.now() < this.cachedInfo.expiresAt) {
      return this.cachedInfo.value;
    }

    const models = await this.listModels();

    if (!models) {
      return this.cacheInfo({
        id: this.id,
        name: this.name,
        status: 'not-configured',
        message: 'Local AI not configured.',
        setupHint
      });
    }

    if (models.length === 0) {
      return this.cacheInfo({
        id: this.id,
        name: this.name,
        status: 'not-configured',
        message: 'Ollama is running, but no local models are installed.',
        setupHint,
        models
      });
    }

    return this.cacheInfo({
      id: this.id,
      name: this.name,
      status: 'available',
      message: `${models.length} local model${models.length === 1 ? '' : 's'} available.`,
      models
    });
  }

  async testConnection(): Promise<TestAIConnectionResult> {
    const provider = await this.getInfo();

    return {
      ok: provider.status === 'available',
      provider,
      message: provider.message
    };
  }

  async generateAnswer(request: GenerateAnswerRequest, onToken?: (token: string) => void): Promise<GenerateAnswerResult> {
    const provider = await this.getInfo();

    if (provider.status !== 'available' || !provider.models?.length) {
      return {
        ok: false,
        provider,
        error: provider.message,
        setupHint: provider.setupHint
      };
    }

    const model = request.model || provider.models[0]?.name;

    if (!model) {
      return {
        ok: false,
        provider,
        error: 'No local Ollama model selected.',
        setupHint
      };
    }

    try {
      const promptResult = this.responseEngine.buildPrompt(request);
      const answer = await this.generateWithOllama(request, model, promptResult.prompt, onToken);
      const followUpQuestions = this.responseEngine.predictFollowUpQuestions({
        question: request.question,
        answer,
        category: promptResult.category,
        request
      });

      return {
        ok: true,
        provider,
        answer,
        category: promptResult.category,
        followUpQuestions
      };
    } catch (error) {
      return {
        ok: false,
        provider: {
          ...provider,
          status: 'error',
          message: 'Ollama generation failed.'
        },
        error: error instanceof Error ? error.message : 'Ollama generation failed.',
        setupHint: 'Make sure Ollama is running and the selected model is installed.'
      };
    }
  }

  private async listModels(): Promise<AIModelInfo[] | null> {
    try {
      const response = await fetch(`${OLLAMA_API_BASE_URL}/tags`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as OllamaTagsResponse;

      return (payload.models ?? [])
        .map((model) => ({
          name: model.model ?? model.name ?? '',
          sizeBytes: model.size,
          parameterSize: model.details?.parameter_size,
          quantizationLevel: model.details?.quantization_level,
          modifiedAt: model.modified_at
        }))
        .filter((model) => model.name.length > 0);
    } catch {
      return null;
    }
  }

  private cacheInfo(info: AIProviderInfo): AIProviderInfo {
    this.cachedInfo = {
      value: info,
      expiresAt: Date.now() + MODEL_INFO_CACHE_MS
    };

    return info;
  }

  private async generateWithOllama(
    request: GenerateAnswerRequest,
    model: string,
    prompt: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${OLLAMA_API_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: true,
        options: {
          temperature: normalizeTemperature(request.temperature),
          num_predict: getTokenLimit(request.maxAnswerLength ?? request.detail)
        }
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama returned HTTP ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const chunk = parseGenerateChunk(line);

        if (!chunk) {
          continue;
        }

        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.response) {
          answer += chunk.response;
          onToken?.(chunk.response);
        }
      }
    }

    const finalChunk = parseGenerateChunk(buffer);

    if (finalChunk?.response) {
      answer += finalChunk.response;
      onToken?.(finalChunk.response);
    }

    return answer.trim();
  }
}

function parseGenerateChunk(line: string): OllamaGenerateChunk | null {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  try {
    return JSON.parse(trimmedLine) as OllamaGenerateChunk;
  } catch {
    return null;
  }
}

function normalizeTemperature(temperature: number | undefined): number {
  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return 0.3;
  }

  return Math.min(Math.max(temperature, 0), 1);
}

function getTokenLimit(detail: AIAnswerDetail): number {
  if (detail === 'short') {
    return 150;
  }

  if (detail === 'expanded') {
    return 460;
  }

  return 280;
}
