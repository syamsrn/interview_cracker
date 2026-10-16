import { contextBridge, ipcRenderer } from 'electron';
import type {
  AIProviderId,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  AIProviderInfo,
  AIStreamToken,
  TestAIConnectionResult
} from '../shared/ai';
import type { GeminiSecretCommandResult, GeminiSecretStatus } from '../shared/gemini';
import type {
  SpeechCommandResult,
  SpeechServiceInfo,
  SpeechStartRequest,
  SpeechTranscriptEvent
} from '../shared/speech';
import type {
  HistoryCommandResult,
  HistoryDatabaseInfo,
  HistoryListResult,
  StoredAnswerRecord
} from '../shared/history';
import type {
  KnowledgeCommandResult,
  KnowledgeDatabaseInfo,
  KnowledgeListResult,
  KnowledgeSearchResult,
  KnowledgeSnippet
} from '../shared/knowledge';
import type { ClearPrivateDataResult, PrivacyInfoResult } from '../shared/privacy';
import type { ResumeCommandResult, ResumeProfileInfo, ResumeProfileResult, ResumeProfileSummary } from '../shared/resume';
import type { AppSettings, SettingsCommandResult, SettingsResult } from '../shared/settings';

function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function generateAnswer(
  request: GenerateAnswerRequest,
  onToken?: (token: string) => void
): Promise<GenerateAnswerResult> {
  const requestId = createRequestId();

  if (!onToken) {
    return ipcRenderer.invoke('ai:generate-answer', {
      ...request,
      requestId
    });
  }

  const tokenListener = (_event: Electron.IpcRendererEvent, payload: AIStreamToken): void => {
    if (payload.requestId === requestId) {
      onToken(payload.token);
    }
  };

  ipcRenderer.on('ai:generate-answer-token', tokenListener);

  return ipcRenderer
    .invoke('ai:generate-answer', {
      ...request,
      requestId
    })
    .finally(() => {
      ipcRenderer.removeListener('ai:generate-answer-token', tokenListener);
    });
}

contextBridge.exposeInMainWorld('interviewApp', {
  window: {
    minimize: () => ipcRenderer.invoke('overlay:minimize'),
    hide: () => ipcRenderer.invoke('overlay:hide'),
    toggle: () => ipcRenderer.invoke('overlay:toggle'),
    toggleProtection: () => ipcRenderer.invoke('overlay:toggle-protection'),
    getProtectionStatus: () => ipcRenderer.invoke('overlay:get-protection-status'),
    onProtectionStatusChange: (callback: (isEnabled: boolean) => void) => {
      ipcRenderer.on('protection-status-changed', (_event, isEnabled) => callback(isEnabled));
    }
  },
  ai: {
    getDefaultProviderInfo: (): Promise<AIProviderInfo> => ipcRenderer.invoke('ai:get-default-provider-info'),
    getProviderInfo: (providerId: AIProviderId): Promise<AIProviderInfo> =>
      ipcRenderer.invoke('ai:get-provider-info', providerId),
    testConnection: (providerId: AIProviderId): Promise<TestAIConnectionResult> =>
      ipcRenderer.invoke('ai:test-connection', providerId),
    generateAnswer
  },
  gemini: {
    getSecretStatus: (): Promise<GeminiSecretStatus> => ipcRenderer.invoke('gemini:get-secret-status'),
    saveApiKey: (apiKey: string): Promise<GeminiSecretCommandResult> =>
      ipcRenderer.invoke('gemini:save-api-key', apiKey),
    deleteApiKey: (): Promise<GeminiSecretCommandResult> => ipcRenderer.invoke('gemini:delete-api-key')
  },
  history: {
    getInfo: (): Promise<HistoryDatabaseInfo> => ipcRenderer.invoke('history:get-info'),
    listAnswers: (): Promise<HistoryListResult> => ipcRenderer.invoke('history:list-answers'),
    saveAnswer: (record: StoredAnswerRecord): Promise<HistoryCommandResult> =>
      ipcRenderer.invoke('history:save-answer', record),
    clearAnswers: (): Promise<HistoryCommandResult> => ipcRenderer.invoke('history:clear-answers')
  },
  knowledge: {
    getInfo: (): Promise<KnowledgeDatabaseInfo> => ipcRenderer.invoke('knowledge:get-info'),
    listSnippets: (): Promise<KnowledgeListResult> => ipcRenderer.invoke('knowledge:list-snippets'),
    searchSnippets: (query: string): Promise<KnowledgeSearchResult> =>
      ipcRenderer.invoke('knowledge:search-snippets', query),
    saveSnippet: (snippet: Partial<KnowledgeSnippet>): Promise<KnowledgeCommandResult> =>
      ipcRenderer.invoke('knowledge:save-snippet', snippet),
    clearSnippets: (): Promise<KnowledgeCommandResult> => ipcRenderer.invoke('knowledge:clear-snippets')
  },
  privacy: {
    getInfo: (): Promise<PrivacyInfoResult> => ipcRenderer.invoke('privacy:get-info'),
    clearPrivateData: (): Promise<ClearPrivateDataResult> => ipcRenderer.invoke('privacy:clear-private-data')
  },
  resume: {
    getInfo: (): Promise<ResumeProfileInfo> => ipcRenderer.invoke('resume:get-info'),
    getProfile: (): Promise<ResumeProfileResult> => ipcRenderer.invoke('resume:get-profile'),
    importPdf: (): Promise<ResumeCommandResult> => ipcRenderer.invoke('resume:import-pdf'),
    saveProfile: (content: string, summary?: Partial<ResumeProfileSummary>): Promise<ResumeCommandResult> =>
      ipcRenderer.invoke('resume:save-profile', { content, summary }),
    clearProfile: (): Promise<ResumeCommandResult> => ipcRenderer.invoke('resume:clear-profile')
  },
  settings: {
    get: (): Promise<SettingsResult> => ipcRenderer.invoke('settings:get'),
    save: (settings: Partial<AppSettings>): Promise<SettingsCommandResult> =>
      ipcRenderer.invoke('settings:save', settings),
    reset: (): Promise<SettingsCommandResult> => ipcRenderer.invoke('settings:reset')
  },
  speech: {
    getInfo: (): Promise<SpeechServiceInfo> => ipcRenderer.invoke('speech:get-info'),
    startMicrophone: (request: SpeechStartRequest): Promise<SpeechCommandResult> =>
      ipcRenderer.invoke('speech:start-microphone', request),
    startSystemAudio: (request: SpeechStartRequest): Promise<SpeechCommandResult> =>
      ipcRenderer.invoke('speech:start-system-audio', request),
    stopMicrophone: (): Promise<SpeechCommandResult> => ipcRenderer.invoke('speech:stop-microphone'),
    onEvent: (callback: (event: SpeechTranscriptEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: SpeechTranscriptEvent): void => {
        callback(payload);
      };

      ipcRenderer.on('speech:event', listener);

      return () => {
        ipcRenderer.removeListener('speech:event', listener);
      };
    }
  }
});
