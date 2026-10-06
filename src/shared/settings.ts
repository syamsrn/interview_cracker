import type { AIAnswerDetail, AIProviderId, AIResponseStyle } from './ai';
import type { SpeechInputSource } from './speech';

export type SavedInterviewMode = 'AUTO' | 'MANUAL';

export interface AppSettings {
  mode: SavedInterviewMode;
  speechSource: SpeechInputSource;
  memoryEnabled: boolean;
  personalKnowledgeEnabled: boolean;
  resumeProfileEnabled: boolean;
  screenShareSafetyEnabled: boolean;
  overlayOpacity: number;
  aiProviderId: AIProviderId;
  aiModel: string;
  temperature: number;
  answerLength: AIAnswerDetail;
  responseStyle: AIResponseStyle;
}

export interface SettingsStoreInfo {
  status: 'ready' | 'error';
  message: string;
  path?: string;
}

export interface SettingsResult {
  ok: boolean;
  settings: AppSettings;
  info: SettingsStoreInfo;
  error?: string;
}

export interface SettingsCommandResult {
  ok: boolean;
  settings: AppSettings;
  info: SettingsStoreInfo;
  error?: string;
}
