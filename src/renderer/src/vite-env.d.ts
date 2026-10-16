/// <reference types="vite/client" />

import type {
  AIProviderId,
  AIProviderInfo,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  TestAIConnectionResult
} from '../../shared/ai';
import type { GeminiSecretCommandResult, GeminiSecretStatus } from '../../shared/gemini';
import type {
  SpeechCommandResult,
  SpeechServiceInfo,
  SpeechStartRequest,
  SpeechTranscriptEvent
} from '../../shared/speech';
import type {
  HistoryCommandResult,
  HistoryDatabaseInfo,
  HistoryListResult,
  StoredAnswerRecord
} from '../../shared/history';
import type {
  KnowledgeCommandResult,
  KnowledgeDatabaseInfo,
  KnowledgeListResult,
  KnowledgeSearchResult,
  KnowledgeSnippet
} from '../../shared/knowledge';
import type { ClearPrivateDataResult, PrivacyInfoResult } from '../../shared/privacy';
import type { ResumeCommandResult, ResumeProfileInfo, ResumeProfileResult, ResumeProfileSummary } from '../../shared/resume';
import type { AppSettings, SettingsCommandResult, SettingsResult } from '../../shared/settings';

declare global {
  interface Window {
    interviewApp?: {
      window: {
        minimize: () => Promise<void>;
        hide: () => Promise<void>;
        toggle: () => Promise<void>;
        toggleProtection: () => Promise<boolean>;
        getProtectionStatus: () => Promise<boolean>;
        onProtectionStatusChange: (callback: (isEnabled: boolean) => void) => void;
      };
      ai: {
        getDefaultProviderInfo: () => Promise<AIProviderInfo>;
        getProviderInfo: (providerId: AIProviderId) => Promise<AIProviderInfo>;
        testConnection: (providerId: AIProviderId) => Promise<TestAIConnectionResult>;
        generateAnswer: (request: GenerateAnswerRequest, onToken?: (token: string) => void) => Promise<GenerateAnswerResult>;
      };
      gemini: {
        getSecretStatus: () => Promise<GeminiSecretStatus>;
        saveApiKey: (apiKey: string) => Promise<GeminiSecretCommandResult>;
        deleteApiKey: () => Promise<GeminiSecretCommandResult>;
      };
      history: {
        getInfo: () => Promise<HistoryDatabaseInfo>;
        listAnswers: () => Promise<HistoryListResult>;
        saveAnswer: (record: StoredAnswerRecord) => Promise<HistoryCommandResult>;
        clearAnswers: () => Promise<HistoryCommandResult>;
      };
      knowledge: {
        getInfo: () => Promise<KnowledgeDatabaseInfo>;
        listSnippets: () => Promise<KnowledgeListResult>;
        searchSnippets: (query: string) => Promise<KnowledgeSearchResult>;
        saveSnippet: (snippet: Partial<KnowledgeSnippet>) => Promise<KnowledgeCommandResult>;
        clearSnippets: () => Promise<KnowledgeCommandResult>;
      };
      privacy: {
        getInfo: () => Promise<PrivacyInfoResult>;
        clearPrivateData: () => Promise<ClearPrivateDataResult>;
      };
      resume: {
        getInfo: () => Promise<ResumeProfileInfo>;
        getProfile: () => Promise<ResumeProfileResult>;
        importPdf: () => Promise<ResumeCommandResult>;
        saveProfile: (content: string, summary?: Partial<ResumeProfileSummary>) => Promise<ResumeCommandResult>;
        clearProfile: () => Promise<ResumeCommandResult>;
      };
      settings: {
        get: () => Promise<SettingsResult>;
        save: (settings: Partial<AppSettings>) => Promise<SettingsCommandResult>;
        reset: () => Promise<SettingsCommandResult>;
      };
      speech: {
        getInfo: () => Promise<SpeechServiceInfo>;
        startMicrophone: (request: SpeechStartRequest) => Promise<SpeechCommandResult>;
        startSystemAudio: (request: SpeechStartRequest) => Promise<SpeechCommandResult>;
        stopMicrophone: () => Promise<SpeechCommandResult>;
        onEvent: (callback: (event: SpeechTranscriptEvent) => void) => () => void;
      };
    };
  }
}

export {};
