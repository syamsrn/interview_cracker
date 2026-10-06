import type {
  AIProviderId,
  AIProviderInfo,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  TestAIConnectionResult
} from '../../../../shared/ai';
import type { AIProvider } from '../types';

export class FutureProvider implements AIProvider {
  readonly id: AIProviderId;
  readonly name: string;

  constructor(id: AIProviderId, name: string) {
    this.id = id;
    this.name = name;
  }

  async getInfo(): Promise<AIProviderInfo> {
    return {
      id: this.id,
      name: this.name,
      status: 'not-configured',
      message: `${this.name} provider is not implemented yet.`,
      setupHint: 'Cloud providers are optional future integrations and must never require hardcoded API keys.'
    };
  }

  async testConnection(): Promise<TestAIConnectionResult> {
    const provider = await this.getInfo();

    return {
      ok: false,
      provider,
      message: provider.message
    };
  }

  async generateAnswer(_request: GenerateAnswerRequest): Promise<GenerateAnswerResult> {
    const provider = await this.getInfo();

    return {
      ok: false,
      provider,
      error: provider.message,
      setupHint: provider.setupHint
    };
  }
}
