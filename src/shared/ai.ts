import type { KnowledgeSnippet } from './knowledge';
import type { ResumeProfile } from './resume';

export type AIProviderId = 'ollama' | 'openai' | 'gemini' | 'claude';

export type AIProviderStatus = 'available' | 'not-configured' | 'error';

export type AIAnswerDetail = 'short' | 'normal' | 'expanded';

export type AIResponseStyle = 'concise' | 'technical' | 'behavioral';

export type InterviewQuestionCategory =
  | 'Python'
  | 'SQL'
  | 'Machine Learning'
  | 'Deep Learning'
  | 'NLP'
  | 'Generative AI'
  | 'RAG'
  | 'LLMs'
  | 'Agents / Agentic AI'
  | 'System Design'
  | 'DSA / Coding'
  | 'Project Questions'
  | 'Resume Questions'
  | 'Behavioral / HR'
  | 'General Technical';

export interface AIModelInfo {
  name: string;
  sizeBytes?: number;
  parameterSize?: string;
  quantizationLevel?: string;
  modifiedAt?: string;
}

export interface AIProviderInfo {
  id: AIProviderId;
  name: string;
  status: AIProviderStatus;
  message: string;
  setupHint?: string;
  models?: AIModelInfo[];
}

export interface AIUsageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIProviderSettings {
  providerId: AIProviderId;
  model: string;
  temperature: number;
  maxAnswerLength: AIAnswerDetail;
  responseStyle: AIResponseStyle;
}

export interface ConversationMemoryItem {
  question: string;
  answer: string;
  category: InterviewQuestionCategory;
}

export interface GenerateAnswerRequest {
  question: string;
  detail: AIAnswerDetail;
  providerId?: AIProviderId;
  model?: string;
  temperature?: number;
  maxAnswerLength?: AIAnswerDetail;
  responseStyle?: AIResponseStyle;
  conversationMemory?: ConversationMemoryItem[];
  personalKnowledge?: KnowledgeSnippet[];
  resumeProfile?: ResumeProfile;
  requestId?: string;
}

export interface GenerateAnswerSuccess {
  ok: true;
  provider: AIProviderInfo;
  answer: string;
  category: InterviewQuestionCategory;
  followUpQuestions: string[];
  usage?: AIUsageMetadata;
}

export interface GenerateAnswerFailure {
  ok: false;
  provider: AIProviderInfo;
  error: string;
  setupHint?: string;
}

export type GenerateAnswerResult = GenerateAnswerSuccess | GenerateAnswerFailure;

export interface TestAIConnectionResult {
  ok: boolean;
  provider: AIProviderInfo;
  message: string;
}

export interface AIStreamToken {
  requestId: string;
  token: string;
}
