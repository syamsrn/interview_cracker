import { ipcMain } from 'electron';
import type {
  AIAnswerDetail,
  AIProviderId,
  AIResponseStyle,
  ConversationMemoryItem,
  GenerateAnswerRequest,
  InterviewQuestionCategory
} from '../../shared/ai';
import type { KnowledgeSnippet } from '../../shared/knowledge';
import type { ResumeProfile } from '../../shared/resume';
import { sanitizeResumeProfileSummary } from '../services/resume/resume-profile-summary';
import { AIService } from '../services/ai/ai-service';

const providerIds: readonly AIProviderId[] = ['ollama', 'openai', 'gemini', 'claude'];
const detailValues: readonly AIAnswerDetail[] = ['short', 'normal', 'expanded'];
const responseStyles: readonly AIResponseStyle[] = ['concise', 'technical', 'behavioral'];
const questionCategories: readonly InterviewQuestionCategory[] = [
  'Python',
  'SQL',
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Generative AI',
  'RAG',
  'LLMs',
  'Agents / Agentic AI',
  'System Design',
  'DSA / Coding',
  'Project Questions',
  'Resume Questions',
  'Behavioral / HR',
  'General Technical'
];
const MAX_MEMORY_ITEMS = 4;
const MAX_MEMORY_FIELD_LENGTH = 700;
const MAX_KNOWLEDGE_ITEMS = 4;
const MAX_KNOWLEDGE_TITLE_LENGTH = 120;
const MAX_KNOWLEDGE_CONTENT_LENGTH = 900;
const MAX_RESUME_PROFILE_LENGTH = 1800;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseGenerateAnswerRequest(value: unknown): GenerateAnswerRequest | null {
  if (!isRecord(value) || typeof value.question !== 'string') {
    return null;
  }

  const detail = detailValues.includes(value.detail as AIAnswerDetail)
    ? (value.detail as AIAnswerDetail)
    : 'normal';
  const providerId =
    value.providerId && providerIds.includes(value.providerId as AIProviderId)
      ? (value.providerId as AIProviderId)
      : undefined;
  const model = typeof value.model === 'string' ? value.model : undefined;
  const temperature = typeof value.temperature === 'number' ? value.temperature : undefined;
  const maxAnswerLength = detailValues.includes(value.maxAnswerLength as AIAnswerDetail)
    ? (value.maxAnswerLength as AIAnswerDetail)
    : undefined;
  const responseStyle = responseStyles.includes(value.responseStyle as AIResponseStyle)
    ? (value.responseStyle as AIResponseStyle)
    : undefined;
  const conversationMemory = parseConversationMemory(value.conversationMemory);
  const personalKnowledge = parsePersonalKnowledge(value.personalKnowledge);
  const resumeProfile = parseResumeProfile(value.resumeProfile);
  const requestId = typeof value.requestId === 'string' ? value.requestId : undefined;

  return {
    question: value.question,
    detail,
    providerId,
    model,
    temperature,
    maxAnswerLength,
    responseStyle,
    conversationMemory,
    personalKnowledge,
    resumeProfile,
    requestId
  };
}

function parseConversationMemory(value: unknown): ConversationMemoryItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const memory = value
    .filter(isRecord)
    .map((item): ConversationMemoryItem | null => {
      if (typeof item.question !== 'string' || typeof item.answer !== 'string') {
        return null;
      }

      const category = questionCategories.includes(item.category as InterviewQuestionCategory)
        ? (item.category as InterviewQuestionCategory)
        : 'General Technical';

      return {
        question: sanitizeMemoryText(item.question),
        answer: sanitizeMemoryText(item.answer),
        category
      };
    })
    .filter((item): item is ConversationMemoryItem => Boolean(item?.question && item.answer))
    .slice(-MAX_MEMORY_ITEMS);

  return memory.length ? memory : undefined;
}

function sanitizeMemoryText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_MEMORY_FIELD_LENGTH);
}

function parsePersonalKnowledge(value: unknown): KnowledgeSnippet[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const snippets = value
    .filter(isRecord)
    .map((item): KnowledgeSnippet | null => {
      if (typeof item.title !== 'string' || typeof item.content !== 'string') {
        return null;
      }

      return {
        id: typeof item.id === 'number' && Number.isFinite(item.id) ? item.id : Date.now(),
        title: item.title.trim().slice(0, MAX_KNOWLEDGE_TITLE_LENGTH),
        content: item.content.trim().replace(/\s+/g, ' ').slice(0, MAX_KNOWLEDGE_CONTENT_LENGTH),
        createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : ''
      };
    })
    .filter((item): item is KnowledgeSnippet => Boolean(item?.title && item.content))
    .slice(0, MAX_KNOWLEDGE_ITEMS);

  return snippets.length ? snippets : undefined;
}

function parseResumeProfile(value: unknown): ResumeProfile | undefined {
  if (!isRecord(value) || typeof value.content !== 'string') {
    return undefined;
  }

  const content = value.content.trim().replace(/\s+/g, ' ').slice(0, MAX_RESUME_PROFILE_LENGTH);

  if (!content) {
    return undefined;
  }

  return {
    content,
    summary: sanitizeResumeProfileSummary(isRecord(value.summary) ? value.summary : undefined, content),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : ''
  };
}

export function registerAIIpcHandlers(aiService: AIService): void {
  ipcMain.handle('ai:get-default-provider-info', () => aiService.getDefaultProviderInfo());

  ipcMain.handle('ai:get-provider-info', (_event, providerId: unknown) => {
    const safeProviderId = providerIds.includes(providerId as AIProviderId)
      ? (providerId as AIProviderId)
      : undefined;

    return aiService.getProviderInfo(safeProviderId);
  });

  ipcMain.handle('ai:test-connection', (_event, providerId: unknown) => {
    const safeProviderId = providerIds.includes(providerId as AIProviderId)
      ? (providerId as AIProviderId)
      : undefined;

    return aiService.testConnection(safeProviderId);
  });

  ipcMain.handle('ai:generate-answer', (event, payload: unknown) => {
    const request = parseGenerateAnswerRequest(payload);

    if (!request) {
      return aiService.generateAnswer({
        question: '',
        detail: 'normal'
      });
    }

    return aiService.generateAnswer(request, (token) => {
      if (request.requestId) {
        event.sender.send('ai:generate-answer-token', {
          requestId: request.requestId,
          token
        });
      }
    });
  });
}
