import type { AIAnswerDetail, InterviewQuestionCategory } from './ai';

export interface StoredAnswerRecord {
  id: number;
  question: string;
  answer: string;
  category: InterviewQuestionCategory;
  detail: AIAnswerDetail;
  createdAt: string;
  followUpQuestions?: string[];
}

export interface HistoryDatabaseInfo {
  status: 'ready' | 'error';
  message: string;
  recordCount: number;
  path?: string;
}

export interface HistoryListResult {
  ok: boolean;
  records: StoredAnswerRecord[];
  info: HistoryDatabaseInfo;
  error?: string;
}

export interface HistoryCommandResult {
  ok: boolean;
  info: HistoryDatabaseInfo;
  error?: string;
}
