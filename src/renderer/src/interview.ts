import type { StoredAnswerRecord } from '../../shared/history';

export type InterviewMode = 'AUTO' | 'MANUAL';

export type InterviewStatus =
  | 'Ready'
  | 'Listening'
  | 'Transcribing'
  | 'Question Detected'
  | 'Thinking'
  | 'Answering'
  | 'Evaluating'
  | 'Answer Ready'
  | 'Error';

export type AnswerDetail = 'short' | 'normal' | 'expanded';

export type AnswerRecord = StoredAnswerRecord;
