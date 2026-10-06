import type {
  AIProviderId,
  AIProviderInfo,
  TestAIConnectionResult,
  GenerateAnswerRequest,
  GenerateAnswerResult
} from '../../../shared/ai';

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;

  getInfo(): Promise<AIProviderInfo>;
  testConnection(): Promise<TestAIConnectionResult>;
  generateAnswer(request: GenerateAnswerRequest, onToken?: (token: string) => void): Promise<GenerateAnswerResult>;
}
