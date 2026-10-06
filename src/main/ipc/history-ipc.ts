import { ipcMain } from 'electron';
import type { AIAnswerDetail, InterviewQuestionCategory } from '../../shared/ai';
import type { StoredAnswerRecord } from '../../shared/history';
import { HistoryDatabase } from '../services/history/history-database';

const detailValues: readonly AIAnswerDetail[] = ['short', 'normal', 'expanded'];
const MAX_FOLLOW_UPS = 3;
const MAX_FOLLOW_UP_LENGTH = 220;
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

export function registerHistoryIpcHandlers(historyDatabase: HistoryDatabase): void {
  ipcMain.handle('history:get-info', () => historyDatabase.getInfo());
  ipcMain.handle('history:list-answers', () => historyDatabase.listAnswers());
  ipcMain.handle('history:clear-answers', () => historyDatabase.clearAnswers());

  ipcMain.handle('history:save-answer', (_event, payload: unknown) => {
    const record = parseStoredAnswerRecord(payload);

    if (!record) {
      return historyDatabase.getInfo().then((info) => ({
        ok: false,
        info,
        error: 'Invalid answer record.'
      }));
    }

    return historyDatabase.saveAnswer(record);
  });
}

function parseStoredAnswerRecord(value: unknown): StoredAnswerRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.question !== 'string' || typeof record.answer !== 'string') {
    return null;
  }

  const category = questionCategories.includes(record.category as InterviewQuestionCategory)
    ? (record.category as InterviewQuestionCategory)
    : 'General Technical';
  const detail = detailValues.includes(record.detail as AIAnswerDetail)
    ? (record.detail as AIAnswerDetail)
    : 'normal';

  return {
    id: typeof record.id === 'number' && Number.isFinite(record.id) ? record.id : Date.now(),
    question: record.question,
    answer: record.answer,
    category,
    detail,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
    followUpQuestions: parseFollowUpQuestions(record.followUpQuestions)
  };
}

function parseFollowUpQuestions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const questions = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/\s+/g, ' ').slice(0, MAX_FOLLOW_UP_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_FOLLOW_UPS);

  return questions.length ? questions : undefined;
}
