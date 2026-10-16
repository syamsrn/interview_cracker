import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { type AnswerDetail, type AnswerRecord, type InterviewMode, type InterviewStatus } from './interview';
import { detectInterviewQuestion, type QuestionDetectionResult } from './question-detection';
import type {
  AIProviderId,
  AIProviderInfo,
  AIProviderSettings,
  AIResponseStyle,
  AIUsageMetadata,
  ConversationMemoryItem,
  GenerateAnswerRequest,
  GenerateAnswerResult,
  TestAIConnectionResult
} from '../../shared/ai';
import type { GeminiSecretCommandResult, GeminiSecretStatus } from '../../shared/gemini';
import type {
  SpeechCommandResult,
  SpeechInputSource,
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
import type { ClearPrivateDataResult, PrivacyInfo, PrivacyInfoResult } from '../../shared/privacy';
import type {
  ResumeCommandResult,
  ResumeProfile,
  ResumeProfileInfo,
  ResumeProfileResult,
  ResumeProfileSummary
} from '../../shared/resume';
import type { AppSettings, SettingsCommandResult, SettingsResult, SettingsStoreInfo } from '../../shared/settings';
import './styles.css';

const EMPTY_CONTENT = '...';
const STATUS_TONE: Record<InterviewStatus, 'neutral' | 'active' | 'pending' | 'success' | 'danger'> = {
  Ready: 'neutral',
  Listening: 'active',
  Transcribing: 'pending',
  'Question Detected': 'success',
  Thinking: 'pending',
  Answering: 'active',
  Evaluating: 'pending',
  'Answer Ready': 'success',
  Error: 'danger'
};

const DEFAULT_PROVIDER_INFO: AIProviderInfo = {
  id: 'ollama',
  name: 'Ollama',
  status: 'not-configured',
  message: 'Checking local AI provider...'
};

const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  providerId: 'ollama',
  model: '',
  temperature: 0.3,
  maxAnswerLength: 'normal',
  responseStyle: 'concise'
};

const DEFAULT_SPEECH_INFO: SpeechServiceInfo = {
  engine: 'faster-whisper',
  status: 'not-configured',
  message: 'Speech service has not been checked yet.'
};
const DEFAULT_HISTORY_INFO: HistoryDatabaseInfo = {
  status: 'ready',
  message: 'Checking local history database...',
  recordCount: 0
};
const DEFAULT_KNOWLEDGE_INFO: KnowledgeDatabaseInfo = {
  status: 'ready',
  message: 'Checking personal knowledge database...',
  snippetCount: 0
};
const DEFAULT_RESUME_INFO: ResumeProfileInfo = {
  status: 'ready',
  message: 'Checking resume profile database...',
  hasProfile: false
};
const DEFAULT_SETTINGS_INFO: SettingsStoreInfo = {
  status: 'ready',
  message: 'Checking local settings...'
};
const DEFAULT_GEMINI_SECRET_STATUS: GeminiSecretStatus = {
  configured: false,
  encryptionAvailable: false,
  message: 'Checking Gemini key status...'
};
const DEFAULT_PRIVACY_INFO: PrivacyInfo = {
  status: 'ready',
  message: 'Checking local privacy stores...',
  localDataPath: '',
  items: [],
  networkSummary: []
};
const MAX_CONVERSATION_MEMORY_ITEMS = 4;

interface InterviewAppApi {
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
}

interface ErrorNotice {
  title: string;
  message: string;
  recovery?: string;
}

const browserPreviewApi: InterviewAppApi = {
  window: {
    minimize: () => Promise.resolve(),
    hide: () => Promise.resolve(),
    toggle: () => Promise.resolve(),
    toggleProtection: () => Promise.resolve(true),
    getProtectionStatus: () => Promise.resolve(true),
    onProtectionStatusChange: () => {}
  },
  ai: {
    getDefaultProviderInfo: () =>
      Promise.resolve({
        id: 'ollama',
        name: 'Ollama',
        status: 'not-configured',
        message: 'Electron preload is unavailable in the browser preview.',
        setupHint: 'Run npm run dev and use the separate Electron desktop overlay window.'
      }),
    getProviderInfo: (providerId: AIProviderId) =>
      Promise.resolve({
        id: providerId,
        name: providerId === 'gemini' ? 'Google Gemini' : providerId === 'ollama' ? 'Ollama' : providerId,
        status: 'not-configured',
        message: 'Electron preload is unavailable in the browser preview.',
        setupHint: 'Run npm run dev and use the separate Electron desktop overlay window.'
      }),
    testConnection: () =>
      Promise.resolve({
        ok: false,
        provider: {
          id: 'ollama',
          name: 'Ollama',
          status: 'not-configured',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        message: 'Use the Electron desktop overlay window, not the localhost browser preview.'
      }),
    generateAnswer: () =>
      Promise.resolve({
        ok: false,
        provider: {
          id: 'ollama',
          name: 'Ollama',
          status: 'not-configured',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Electron preload is unavailable in the browser preview.',
        setupHint: 'Use the separate Electron desktop overlay window launched by npm run dev.'
      })
  },
  gemini: {
    getSecretStatus: () =>
      Promise.resolve({
        configured: false,
        encryptionAvailable: false,
        message: 'Electron preload is unavailable in the browser preview.'
      }),
    saveApiKey: () =>
      Promise.resolve({
        ok: false,
        status: {
          configured: false,
          encryptionAvailable: false,
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    deleteApiKey: () =>
      Promise.resolve({
        ok: false,
        status: {
          configured: false,
          encryptionAvailable: false,
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  history: {
    getInfo: () =>
      Promise.resolve({
        status: 'error',
        message: 'Electron preload is unavailable in the browser preview.',
        recordCount: 0
      }),
    listAnswers: () =>
      Promise.resolve({
        ok: false,
        records: [],
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          recordCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    saveAnswer: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          recordCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    clearAnswers: () => Promise.resolve({
      ok: false,
      info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          recordCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  knowledge: {
    getInfo: () =>
      Promise.resolve({
        status: 'error',
        message: 'Electron preload is unavailable in the browser preview.',
        snippetCount: 0
      }),
    listSnippets: () =>
      Promise.resolve({
        ok: false,
        snippets: [],
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          snippetCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    searchSnippets: () =>
      Promise.resolve({
        ok: false,
        snippets: [],
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          snippetCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    saveSnippet: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          snippetCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    clearSnippets: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          snippetCount: 0
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  privacy: {
    getInfo: () =>
      Promise.resolve({
        ok: false,
        info: {
          ...DEFAULT_PRIVACY_INFO,
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    clearPrivateData: () =>
      Promise.resolve({
        ok: false,
        info: {
          ...DEFAULT_PRIVACY_INFO,
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        settings: buildCurrentSettingsFromDefaults(),
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  resume: {
    getInfo: () =>
      Promise.resolve({
        status: 'error',
        message: 'Electron preload is unavailable in the browser preview.',
        hasProfile: false
      }),
    getProfile: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          hasProfile: false
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    importPdf: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          hasProfile: false
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    saveProfile: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          hasProfile: false
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    clearProfile: () =>
      Promise.resolve({
        ok: false,
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.',
          hasProfile: false
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  settings: {
    get: () =>
      Promise.resolve({
        ok: false,
        settings: buildCurrentSettingsFromDefaults(),
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    save: () =>
      Promise.resolve({
        ok: false,
        settings: buildCurrentSettingsFromDefaults(),
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      }),
    reset: () =>
      Promise.resolve({
        ok: false,
        settings: buildCurrentSettingsFromDefaults(),
        info: {
          status: 'error',
          message: 'Electron preload is unavailable in the browser preview.'
        },
        error: 'Use the Electron desktop overlay window launched by npm run dev.'
      })
  },
  speech: {
    getInfo: () =>
      Promise.resolve({
        engine: 'faster-whisper',
        status: 'not-configured',
        message: 'Electron preload is unavailable in the browser preview.',
        setupHint: 'Run npm run dev and use the separate Electron desktop overlay window.'
      }),
    startMicrophone: () =>
      Promise.resolve({
        ok: false,
        message: 'Microphone transcription requires the Electron desktop overlay.'
      }),
    startSystemAudio: () =>
      Promise.resolve({
        ok: false,
        message: 'System audio transcription requires the Electron desktop overlay.'
      }),
    stopMicrophone: () =>
      Promise.resolve({
        ok: false,
        message: 'Microphone transcription is not running.'
      }),
    onEvent: () => () => undefined
  }
};

function getInterviewAppApi(): InterviewAppApi {
  return window.interviewApp ?? browserPreviewApi;
}

function buildCurrentSettingsFromDefaults(): AppSettings {
  return {
    mode: 'MANUAL',
    speechSource: 'microphone',
    memoryEnabled: true,
    personalKnowledgeEnabled: true,
    resumeProfileEnabled: true,
    screenShareSafetyEnabled: false,
    overlayOpacity: 0.92,
    aiProviderId: DEFAULT_AI_SETTINGS.providerId,
    aiModel: DEFAULT_AI_SETTINGS.model,
    temperature: DEFAULT_AI_SETTINGS.temperature,
    answerLength: DEFAULT_AI_SETTINGS.maxAnswerLength,
    responseStyle: DEFAULT_AI_SETTINGS.responseStyle
  };
}

function mergeTranscript(currentTranscript: string, nextText: string): string {
  const trimmedCurrent = currentTranscript.trim();
  const trimmedNext = nextText.trim();

  if (!trimmedNext) {
    return trimmedCurrent;
  }

  if (!trimmedCurrent) {
    return trimmedNext;
  }

  if (trimmedCurrent.endsWith(trimmedNext)) {
    return trimmedCurrent;
  }

  return `${trimmedCurrent} ${trimmedNext}`;
}

function buildConversationMemory(history: AnswerRecord[], submittedQuestion: string): ConversationMemoryItem[] {
  const normalizedSubmittedQuestion = submittedQuestion.trim().toLowerCase();

  return history
    .filter((record) => record.question.trim() && record.answer.trim())
    .filter((record) => {
      if (!normalizedSubmittedQuestion) {
        return true;
      }

      return record.question.trim().toLowerCase() !== normalizedSubmittedQuestion;
    })
    .slice(-MAX_CONVERSATION_MEMORY_ITEMS)
    .map((record) => ({
      question: record.question,
      answer: record.answer,
      category: record.category
    }));
}

function shouldUseResumeProfile(question: string, profile: ResumeProfile | null): profile is ResumeProfile {
  return Boolean(question.trim() && profile?.content.trim());
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0.1, durationMs / 1000);

  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function formatUsage(usage: AIUsageMetadata | undefined): string {
  if (!usage?.totalTokens) {
    return '';
  }

  const parts = [`${usage.totalTokens} tokens`];

  if (usage.inputTokens) {
    parts.push(`${usage.inputTokens} in`);
  }

  if (usage.outputTokens) {
    parts.push(`${usage.outputTokens} out`);
  }

  return parts.join(', ');
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function App(): React.JSX.Element {
  const statusTimerRef = useRef<number | null>(null);
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const answerContentRef = useRef<HTMLDivElement | null>(null);
  const generationInFlightRef = useRef(false);
  const keyboardShortcutRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const settingsLoadedRef = useRef(false);
  const settingsSaveTimerRef = useRef<number | null>(null);
  const appApi = useMemo(() => getInterviewAppApi(), []);
  const [isProtected, setIsProtected] = useState(true);
  useEffect(() => {
    appApi.window.getProtectionStatus().then(setIsProtected);
    appApi.window.onProtectionStatusChange(setIsProtected);
  }, [appApi]);
  const modeRef = useRef<InterviewMode>('MANUAL');
  const answerDetailRef = useRef<AnswerDetail>('normal');
  const transcriptRef = useRef('');
  const speechAutoGenerationRequestedRef = useRef(false);
  const liveQuestionTimerRef = useRef<number | null>(null);
  const aiSettingsRef = useRef<AIProviderSettings>(DEFAULT_AI_SETTINGS);
  const speechSourceRef = useRef<SpeechInputSource>('microphone');
  const historyRef = useRef<AnswerRecord[]>([]);
  const memoryEnabledRef = useRef(true);
  const personalKnowledgeEnabledRef = useRef(true);
  const resumeProfileEnabledRef = useRef(true);
  const resumeProfileRef = useRef<ResumeProfile | null>(null);
  const [mode, setMode] = useState<InterviewMode>('MANUAL');
  const [question, setQuestion] = useState('');
  const [activeQuestion, setActiveQuestion] = useState('');
  const [answer, setAnswer] = useState(EMPTY_CONTENT);
  const [answerFullyRead, setAnswerFullyRead] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [errorNotice, setErrorNotice] = useState<ErrorNotice | null>(null);
  const [status, setStatus] = useState<InterviewStatus>('Ready');
  const [answerDetail, setAnswerDetail] = useState<AnswerDetail>('normal');
  const [history, setHistory] = useState<AnswerRecord[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyDatabaseInfo, setHistoryDatabaseInfo] = useState<HistoryDatabaseInfo>(DEFAULT_HISTORY_INFO);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [knowledgeDatabaseInfo, setKnowledgeDatabaseInfo] = useState<KnowledgeDatabaseInfo>(DEFAULT_KNOWLEDGE_INFO);
  const [personalKnowledgeEnabled, setPersonalKnowledgeEnabled] = useState(true);
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [resumeProfileInfo, setResumeProfileInfo] = useState<ResumeProfileInfo>(DEFAULT_RESUME_INFO);
  const [resumeProfileEnabled, setResumeProfileEnabled] = useState(true);
  const [screenShareSafetyEnabled, setScreenShareSafetyEnabled] = useState(false);
  const [overlayOpacity, setOverlayOpacity] = useState(0.92);
  const [resumeProfile, setResumeProfile] = useState<ResumeProfile | null>(null);
  const [resumeProfileContent, setResumeProfileContent] = useState('');
  const [resumeProfileSummary, setResumeProfileSummary] = useState<ResumeProfileSummary>({
    name: '',
    targetRole: '',
    skills: '',
    projects: '',
    experience: ''
  });
  const [settingsInfo, setSettingsInfo] = useState<SettingsStoreInfo>(DEFAULT_SETTINGS_INFO);
  const [privacyInfo, setPrivacyInfo] = useState<PrivacyInfo>(DEFAULT_PRIVACY_INFO);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerInfo, setProviderInfo] = useState<AIProviderInfo>(DEFAULT_PROVIDER_INFO);
  const [aiSettings, setAiSettings] = useState<AIProviderSettings>(DEFAULT_AI_SETTINGS);
  const [geminiSecretStatus, setGeminiSecretStatus] = useState<GeminiSecretStatus>(DEFAULT_GEMINI_SECRET_STATUS);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [geminiKeyBusy, setGeminiKeyBusy] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [speechInfo, setSpeechInfo] = useState<SpeechServiceInfo>(DEFAULT_SPEECH_INFO);
  const [speechSource, setSpeechSource] = useState<SpeechInputSource>('microphone');
  const [isSpeechActive, setIsSpeechActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [questionDetection, setQuestionDetection] = useState<QuestionDetectionResult | null>(null);
  const [speechSignalLevel, setSpeechSignalLevel] = useState(0);

  const questionPreview = useMemo(() => activeQuestion || question.trim() || EMPTY_CONTENT, [activeQuestion, question]);
  const canGoPrevious = historyIndex > 0;
  const canGoNext = historyIndex >= 0 && historyIndex < history.length - 1;
  const canGenerate = Boolean(question.trim()) && !isGenerating;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    answerDetailRef.current = answerDetail;
  }, [answerDetail]);

  useEffect(() => {
    aiSettingsRef.current = aiSettings;
  }, [aiSettings]);

  useEffect(() => {
    speechSourceRef.current = speechSource;
  }, [speechSource]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    memoryEnabledRef.current = memoryEnabled;
  }, [memoryEnabled]);

  useEffect(() => {
    personalKnowledgeEnabledRef.current = personalKnowledgeEnabled;
  }, [personalKnowledgeEnabled]);

  useEffect(() => {
    resumeProfileEnabledRef.current = resumeProfileEnabled;
  }, [resumeProfileEnabled]);

  useEffect(() => {
    resumeProfileRef.current = resumeProfile;
  }, [resumeProfile]);

  useEffect(() => {
    if (isGenerating || !answerContentRef.current || !answer || answer === EMPTY_CONTENT) {
      return;
    }

    const answerElement = answerContentRef.current;

    if (answerElement.scrollHeight <= answerElement.clientHeight + 8) {
      setAnswerFullyRead(true);
    }
  }, [answer, isGenerating]);

  useEffect(() => {
    appApi.settings
      .get()
      .then((result) => {
        setSettingsInfo(result.info);

        if (!result.ok) {
          showRecoverableError('Settings unavailable', result.error ?? result.info.message, 'The app will continue with default preferences.');
        }

        applySavedSettings(result.settings);
        settingsLoadedRef.current = true;
      })
      .catch(() => {
        const settingsFailure = {
          status: 'error',
          message: 'Unable to read local settings.'
        } satisfies SettingsStoreInfo;

        setSettingsInfo(settingsFailure);
        showRecoverableError('Settings unavailable', settingsFailure.message, 'The app will continue with default preferences.');
        settingsLoadedRef.current = true;
      });

    appApi.ai
      .getDefaultProviderInfo()
      .then((info) => {
        setProviderInfo(info);
        setDefaultModelFromProvider(info);
      })
      .catch(() => {
        const providerFailure = {
          id: 'ollama',
          name: 'Ollama',
          status: 'error',
          message: 'Unable to read local AI provider status.',
          setupHint: 'Restart the app and try again. If the problem persists, check the main process logs.'
        } satisfies AIProviderInfo;

        setProviderInfo(providerFailure);
        showRecoverableError('AI provider check failed', providerFailure.message, providerFailure.setupHint);
      });

    appApi.gemini
      .getSecretStatus()
      .then((status) => {
        setGeminiSecretStatus(status);
      })
      .catch(() => {
        setGeminiSecretStatus({
          configured: false,
          encryptionAvailable: false,
          message: 'Unable to read Gemini key status.'
        });
      });

    appApi.speech
      .getInfo()
      .then((info) => {
        setSpeechInfo(info);
      })
      .catch(() => {
        const speechFailure = {
          engine: 'faster-whisper',
          status: 'error',
          message: 'Unable to read speech service status.',
          setupHint: 'Restart the app and try again. If the problem persists, check the main process logs.'
        } satisfies SpeechServiceInfo;

        setSpeechInfo(speechFailure);
        showRecoverableError('Speech service check failed', speechFailure.message, speechFailure.setupHint);
      });

    appApi.history
      .listAnswers()
      .then((result) => {
        setHistoryDatabaseInfo(result.info);

        if (!result.ok || !result.records.length) {
          return;
        }

        setHistory(result.records);
        setHistoryIndex(result.records.length - 1);
        setFollowUpQuestions(result.records[result.records.length - 1]?.followUpQuestions ?? []);
      })
      .catch(() => {
        const historyFailure = {
          status: 'error',
          message: 'Unable to read local history database.',
          recordCount: 0
        } satisfies HistoryDatabaseInfo;

        setHistoryDatabaseInfo(historyFailure);
        showRecoverableError('Local history unavailable', historyFailure.message, 'You can keep practicing, but saved answer history may not load.');
      });

    appApi.knowledge
      .getInfo()
      .then((info) => {
        setKnowledgeDatabaseInfo(info);
      })
      .catch(() => {
        const knowledgeFailure = {
          status: 'error',
          message: 'Unable to read personal knowledge database.',
          snippetCount: 0
        } satisfies KnowledgeDatabaseInfo;

        setKnowledgeDatabaseInfo(knowledgeFailure);
        showRecoverableError('Personal knowledge unavailable', knowledgeFailure.message, 'Answers will continue without saved knowledge snippets.');
      });

    appApi.resume
      .getProfile()
      .then((result) => {
        setResumeProfileInfo(result.info);

        if (!result.ok || !result.profile) {
          return;
        }

        setResumeProfile(result.profile);
        setResumeProfileContent(result.profile.content);
        setResumeProfileSummary(result.profile.summary);
      })
      .catch(() => {
        const resumeFailure = {
          status: 'error',
          message: 'Unable to read resume profile database.',
          hasProfile: false
        } satisfies ResumeProfileInfo;

        setResumeProfileInfo(resumeFailure);
        showRecoverableError('Resume profile unavailable', resumeFailure.message, 'Resume-aware answers will continue without saved profile context.');
      });

    appApi.privacy
      .getInfo()
      .then((result) => {
        setPrivacyInfo(result.info);

        if (!result.ok) {
          showRecoverableError('Privacy status unavailable', result.error ?? result.info.message, 'You can continue using the app, but local storage status may be incomplete.');
        }
      })
      .catch(() => {
        const privacyFailure = {
          ...DEFAULT_PRIVACY_INFO,
          status: 'error',
          message: 'Unable to read privacy status.'
        } satisfies PrivacyInfo;

        setPrivacyInfo(privacyFailure);
        showRecoverableError('Privacy status unavailable', privacyFailure.message, 'Restart the app if this repeats.');
      });

    const unsubscribeSpeechEvents = appApi.speech.onEvent((event) => {
      if (event.type === 'status' && event.message) {
        setConnectionMessage(event.message);
      }

      if (event.type === 'level') {
        const level = event.level ?? 0;
        setSpeechSignalLevel(level);
        setConnectionMessage(
          level >= 0.00005
            ? 'Audio detected. Updating the live transcript...'
            : speechSourceRef.current === 'system-audio'
              ? 'No system-audio signal detected. Check that playback uses the active Windows speaker.'
              : 'No microphone signal detected yet. Speak closer or check the selected input.'
        );
      }

      if (event.type === 'partial' && event.text) {
        const liveTranscript = mergeTranscript(transcriptRef.current, event.text);
        transcriptRef.current = liveTranscript;
        setTranscript(liveTranscript);
        setQuestion(liveTranscript);
        setStatus('Transcribing');
        setConnectionMessage('Live transcript updating...');

        const detection = detectInterviewQuestion(liveTranscript);

        if (detection.isQuestion) {
          setQuestionDetection(detection);
          scheduleLiveQuestionDetection(liveTranscript);
        }
      }

      if (event.type === 'final') {
        const finalText = event.text?.trim() ?? '';
        const detection = detectInterviewQuestion(finalText);

        clearLiveQuestionTimer();
        setIsSpeechActive(false);
        transcriptRef.current = finalText;
        setTranscript(finalText);
        setQuestion(finalText);
        setQuestionDetection(detection);

        if (!finalText) {
          const sourceLabel = speechSourceRef.current === 'system-audio' ? 'system audio' : 'speech';
          setStatus('Ready');
          setConnectionMessage(
            speechSourceRef.current === 'system-audio'
              ? 'No system audio was transcribed. Make sure playback is running, unmuted, and routed to the selected output device.'
              : `No ${sourceLabel} was transcribed. Try speaking a little closer to the microphone.`
          );
          return;
        }

        if (!detection.isQuestion) {
          setStatus('Ready');
          setConnectionMessage(`Transcript ready. ${detection.reason}`);
          return;
        }

        if (modeRef.current === 'AUTO' && !speechAutoGenerationRequestedRef.current) {
          speechAutoGenerationRequestedRef.current = true;
          setConnectionMessage(`Question detected (${detection.confidence}). Generating answer automatically...`);
          requestAnswer(answerDetailRef.current, finalText);
          return;
        }

        setStatus('Question Detected');
        setConnectionMessage(`Question detected (${detection.confidence}). Click Generate when you want an answer.`);
      }

      if (event.type === 'error') {
        setIsSpeechActive(false);
        const message = event.message ?? 'Speech transcription failed.';

        setAnswer(message);
        showRecoverableError('Speech transcription failed', message, 'Stop listening and start again. If it repeats, check Settings -> Speech.');
      }
    });

    return () => {
      unsubscribeSpeechEvents();
      clearStatusTimer();
      clearSettingsSaveTimer();
      clearLiveQuestionTimer();
    };
  }, [appApi]);

  useEffect(() => {
    if (!settingsLoadedRef.current) {
      return;
    }

    let cancelled = false;

    appApi.ai
      .getProviderInfo(aiSettings.providerId)
      .then((info) => {
        if (cancelled) {
          return;
        }

        setProviderInfo(info);
        setDefaultModelFromProvider(info);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const providerFailure = {
          id: aiSettings.providerId,
          name: aiSettings.providerId === 'gemini' ? 'Google Gemini' : aiSettings.providerId,
          status: 'error',
          message: 'Unable to read AI provider status.',
          setupHint: 'Restart the app and try again. If the problem persists, check the main process logs.'
        } satisfies AIProviderInfo;

        setProviderInfo(providerFailure);
        showRecoverableError('AI provider check failed', providerFailure.message, providerFailure.setupHint);
      });

    return () => {
      cancelled = true;
    };
  }, [appApi, aiSettings.providerId]);

  function clearStatusTimer(): void {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
  }

  function clearSettingsSaveTimer(): void {
    if (settingsSaveTimerRef.current) {
      window.clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }
  }

  function clearErrorNotice(): void {
    setErrorNotice(null);
  }

  function showRecoverableError(title: string, message: string, recovery?: string): void {
    setErrorNotice({
      title,
      message,
      recovery
    });
    setConnectionMessage(message);
    setStatus('Error');
  }

  function setDefaultModelFromProvider(info: AIProviderInfo): void {
    const firstModel = info.models?.[0]?.name;

    if (!firstModel) {
      return;
    }

    setAiSettings((currentSettings) => ({
      ...currentSettings,
      model: currentSettings.model && info.models?.some((model) => model.name === currentSettings.model)
        ? currentSettings.model
        : firstModel
    }));
  }

  function applySavedSettings(settings: AppSettings): void {
    setMode(settings.mode);
    setSpeechSource(settings.speechSource);
    setMemoryEnabled(settings.memoryEnabled);
    setPersonalKnowledgeEnabled(settings.personalKnowledgeEnabled);
    setResumeProfileEnabled(settings.resumeProfileEnabled);
    setScreenShareSafetyEnabled(settings.screenShareSafetyEnabled);
    setOverlayOpacity(settings.overlayOpacity);
    setAnswerDetail(settings.answerLength);
    setAiSettings({
      providerId: settings.aiProviderId,
      model: settings.aiModel,
      temperature: settings.temperature,
      maxAnswerLength: settings.answerLength,
      responseStyle: settings.responseStyle
    });
  }

  function buildCurrentSettings(): AppSettings {
    return {
      mode,
      speechSource,
      memoryEnabled,
      personalKnowledgeEnabled,
      resumeProfileEnabled,
      screenShareSafetyEnabled,
      overlayOpacity,
      aiProviderId: aiSettings.providerId,
      aiModel: aiSettings.model,
      temperature: aiSettings.temperature,
      answerLength: answerDetail,
      responseStyle: aiSettings.responseStyle
    };
  }

  async function handleResetPreferences(): Promise<void> {
    const shouldReset = window.confirm('Reset app preferences to defaults? Saved history, knowledge, and resume profile will not be deleted.');

    if (!shouldReset) {
      return;
    }

    clearErrorNotice();

    try {
      const result = await appApi.settings.reset();

      setSettingsInfo(result.info);

      if (!result.ok) {
        showRecoverableError('Reset preferences failed', result.error ?? result.info.message, 'Try again from Settings.');
        return;
      }

      applySavedSettings(result.settings);
      setConnectionMessage('Preferences reset to defaults. Saved history, knowledge, and resume profile were unchanged.');
      setStatus('Ready');
    } catch {
      const settingsFailure = {
        status: 'error',
        message: 'Unable to reset preferences.'
      } satisfies SettingsStoreInfo;

      setSettingsInfo(settingsFailure);
      showRecoverableError('Reset preferences failed', settingsFailure.message, 'Try again from Settings.');
    }
  }

  useEffect(() => {
    if (!settingsLoadedRef.current) {
      return;
    }

    clearSettingsSaveTimer();

    settingsSaveTimerRef.current = window.setTimeout(() => {
      appApi.settings
        .save(buildCurrentSettings())
        .then((result) => {
          setSettingsInfo(result.info);

          if (!result.ok) {
            showRecoverableError('Save preferences failed', result.error ?? result.info.message, 'Preference changes may not persist after restart.');
          }
        })
        .catch(() => {
          const settingsFailure = {
            status: 'error',
            message: 'Unable to save preferences.'
          } satisfies SettingsStoreInfo;

          setSettingsInfo(settingsFailure);
          showRecoverableError('Save preferences failed', settingsFailure.message, 'Preference changes may not persist after restart.');
        });
    }, 500);

    return clearSettingsSaveTimer;
  }, [
    appApi,
    mode,
    speechSource,
    memoryEnabled,
    personalKnowledgeEnabled,
    resumeProfileEnabled,
    screenShareSafetyEnabled,
    overlayOpacity,
    aiSettings,
    answerDetail
  ]);

  async function requestAnswer(detail: AnswerDetail, questionOverride?: string): Promise<void> {
    clearStatusTimer();
    const submittedQuestion = (questionOverride ?? question).trim();

    if (!submittedQuestion) {
      setAnswer('Type an interview question first, then generate an answer.');
      showRecoverableError(
        'Question required',
        'Type an interview question first, then generate an answer.',
        'Use Ctrl+K to focus the question box.'
      );
      return;
    }

    if (generationInFlightRef.current) {
      setConnectionMessage('Answer generation is already running.');
      return;
    }

    generationInFlightRef.current = true;
    setIsGenerating(true);
    setAnswerFullyRead(false);
    setActiveQuestion(submittedQuestion);
    setQuestion('');
    setTranscript('');
    window.setTimeout(() => questionInputRef.current?.focus(), 0);

    try {
      clearErrorNotice();
      setStatus('Thinking');
      setAnswer('');
      setFollowUpQuestions([]);
      setQuestionDetection(detectInterviewQuestion(submittedQuestion));
      const activeSettings = aiSettingsRef.current;

      let result: GenerateAnswerResult;

      const generationStartedAt = window.performance.now();

      try {
        const knowledgeResult =
          personalKnowledgeEnabledRef.current && knowledgeDatabaseInfo.snippetCount > 0
            ? await appApi.knowledge.searchSnippets(submittedQuestion)
            : null;
        const activeResumeProfile =
          resumeProfileEnabledRef.current && shouldUseResumeProfile(submittedQuestion, resumeProfileRef.current)
            ? resumeProfileRef.current
            : undefined;

        if (knowledgeResult?.info) {
          setKnowledgeDatabaseInfo(knowledgeResult.info);
        }

        result = await appApi.ai.generateAnswer({
          question: submittedQuestion,
          detail,
          providerId: activeSettings.providerId,
          model: activeSettings.model,
          temperature: activeSettings.temperature,
          maxAnswerLength: detail,
          responseStyle: activeSettings.responseStyle,
          conversationMemory: memoryEnabledRef.current
            ? buildConversationMemory(historyRef.current, submittedQuestion)
            : undefined,
          personalKnowledge: knowledgeResult?.ok ? knowledgeResult.snippets : undefined,
          resumeProfile: activeResumeProfile
        }, (token) => {
          setStatus('Answering');
          setAnswer((currentAnswer) => `${currentAnswer}${token}`);
        });
      } catch {
        result = {
          ok: false,
          provider: {
            id: 'ollama',
            name: 'Ollama',
            status: 'error',
            message: 'Unable to contact the local AI provider service.'
          },
          error: 'Unable to contact the local AI provider service.',
          setupHint: 'Restart the app and try again. If the problem persists, check the main process logs.'
        };
      }

      setProviderInfo(result.provider);
      setDefaultModelFromProvider(result.provider);

      if (!result.ok) {
        setAnswer(formatProviderFailure(result));
        setFollowUpQuestions([]);
        showRecoverableError(
          'Answer generation failed',
          result.error,
          result.setupHint ?? result.provider.setupHint ?? 'Check Ollama, select an installed model, and try again.'
        );
        return;
      }

      const nextAnswer = result.answer;
      const nextFollowUps = result.followUpQuestions;
      const nextRecord: AnswerRecord = {
        id: Date.now(),
        question: submittedQuestion,
        answer: nextAnswer,
        category: result.category,
        detail,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }),
        followUpQuestions: nextFollowUps
      };

      setAnswer(nextAnswer);
      setFollowUpQuestions(nextFollowUps);
      const usageSummary = formatUsage(result.usage);
      setConnectionMessage(
        `Answered in ${formatDuration(window.performance.now() - generationStartedAt)}${usageSummary ? ` (${usageSummary})` : ''}.`
      );
      setHistory((currentHistory) => {
        const nextHistory = [...currentHistory, nextRecord];
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
      appApi.history
        .saveAnswer(nextRecord)
        .then((saveResult) => {
          setHistoryDatabaseInfo(saveResult.info);

          if (!saveResult.ok && saveResult.error) {
            showRecoverableError('Local save failed', saveResult.error, 'The answer is still visible in this session, but may not be saved.');
          }
        })
        .catch(() => {
          const historyFailure = {
            status: 'error',
            message: 'Unable to save answer locally.',
            recordCount: historyRef.current.length
          } satisfies HistoryDatabaseInfo;

          setHistoryDatabaseInfo(historyFailure);
          showRecoverableError('Local save failed', historyFailure.message, 'You can continue practicing, but this answer may not persist after restart.');
        });
      setStatus('Answer Ready');
    } finally {
      generationInFlightRef.current = false;
      setIsGenerating(false);
    }
  }

  function formatProviderFailure(result: GenerateAnswerResult): string {
    if (result.ok) {
      return result.answer;
    }

    return [result.error, '', result.setupHint ?? result.provider.setupHint ?? 'Configure a local AI provider to generate answers.'].join(
      '\n'
    );
  }

  function handleSetAnswerLength(nextLength: AnswerDetail): void {
    setAnswerDetail(nextLength);
    setAiSettings((currentSettings) => ({
      ...currentSettings,
      maxAnswerLength: nextLength
    }));
  }

  function handleGenerate(): void {
    setQuestionDetection(detectInterviewQuestion(question));
    requestAnswer(answerDetail);
  }

  function handleProviderChange(nextProviderId: AIProviderId): void {
    setAiSettings((currentSettings) => ({
      ...currentSettings,
      providerId: nextProviderId,
      model: ''
    }));
    setConnectionMessage(`AI provider changed to ${nextProviderId === 'gemini' ? 'Google Gemini' : nextProviderId}.`);
    setStatus('Ready');
  }

  async function handleTestConnection(): Promise<void> {
    clearErrorNotice();
    setConnectionMessage(`Testing ${providerInfo.name} connection...`);

    const result = await appApi.ai.testConnection(aiSettings.providerId);

    setProviderInfo(result.provider);
    setDefaultModelFromProvider(result.provider);
    setConnectionMessage(result.message);

    if (aiSettings.providerId === 'gemini') {
      appApi.gemini.getSecretStatus().then(setGeminiSecretStatus).catch(() => undefined);
    }

    if (result.ok) {
      setStatus('Ready');
      return;
    }

    showRecoverableError('AI connection failed', result.message, result.provider.setupHint ?? 'Check the selected AI provider and try again.');
  }

  async function handleSaveGeminiApiKey(): Promise<void> {
    clearErrorNotice();
    setGeminiKeyBusy(true);
    setConnectionMessage('Saving Gemini API key locally...');

    try {
      const result = await appApi.gemini.saveApiKey(geminiApiKeyInput);

      setGeminiSecretStatus(result.status);

      if (!result.ok) {
        showRecoverableError('Gemini key save failed', result.error ?? result.status.message, 'Check the key and try saving again.');
        return;
      }

      setGeminiApiKeyInput('');
      setConnectionMessage('Gemini API key saved locally. Test the Gemini connection next.');

      if (aiSettingsRef.current.providerId === 'gemini') {
        const info = await appApi.ai.getProviderInfo('gemini');
        setProviderInfo(info);
        setDefaultModelFromProvider(info);
      }

      setStatus('Ready');
    } catch {
      showRecoverableError('Gemini key save failed', 'Unable to save Gemini API key.', 'Restart the app and try again.');
    } finally {
      setGeminiKeyBusy(false);
    }
  }

  async function handleDeleteGeminiApiKey(): Promise<void> {
    const shouldDelete = window.confirm('Delete the saved Gemini API key from this device?');

    if (!shouldDelete) {
      return;
    }

    clearErrorNotice();
    setGeminiKeyBusy(true);
    setConnectionMessage('Deleting saved Gemini API key...');

    try {
      const result = await appApi.gemini.deleteApiKey();

      setGeminiSecretStatus(result.status);
      setGeminiApiKeyInput('');

      if (!result.ok) {
        showRecoverableError('Gemini key delete failed', result.error ?? result.status.message, 'Try again from Settings.');
        return;
      }

      if (aiSettingsRef.current.providerId === 'gemini') {
        const info = await appApi.ai.getProviderInfo('gemini');
        setProviderInfo(info);
        setDefaultModelFromProvider(info);
      }

      setConnectionMessage('Saved Gemini API key deleted from this device.');
      setStatus('Ready');
    } catch {
      showRecoverableError('Gemini key delete failed', 'Unable to delete Gemini API key.', 'Restart the app and try again.');
    } finally {
      setGeminiKeyBusy(false);
    }
  }

  async function handleCheckSpeechService(): Promise<void> {
    clearErrorNotice();
    setConnectionMessage('Checking speech service...');

    try {
      const info = await appApi.speech.getInfo();

      setSpeechInfo(info);
      setConnectionMessage(info.status === 'ready' ? `Speech service ready. ${info.message}` : info.message);
      if (info.status === 'ready') {
        setStatus('Ready');
        return;
      }

      showRecoverableError('Speech service unavailable', info.message, info.setupHint ?? 'Check the local Python speech environment.');
    } catch {
      const speechFailure = {
        engine: 'faster-whisper',
        status: 'error',
        message: 'Unable to read speech service status.',
        setupHint: 'Restart the app and try again. If the problem persists, check the main process logs.'
      } satisfies SpeechServiceInfo;

      setSpeechInfo(speechFailure);
      showRecoverableError('Speech service check failed', speechFailure.message, speechFailure.setupHint);
    }
  }

  async function handleStartListening(): Promise<void> {
    clearStatusTimer();
    clearLiveQuestionTimer();
    clearErrorNotice();
    const info = await appApi.speech.getInfo();

    setSpeechInfo(info);

    if (info.status !== 'ready') {
      setAnswer([info.message, '', info.setupHint ?? 'Speech-to-text architecture is selected, but microphone capture starts in Stage 7.'].join('\n'));
      showRecoverableError('Speech service unavailable', info.message, info.setupHint ?? 'Open Settings and run Check Speech Service.');
      return;
    }

    transcriptRef.current = '';
    speechAutoGenerationRequestedRef.current = false;
    setSpeechSignalLevel(0);
    setTranscript('');
    setQuestion('');
    setActiveQuestion('');
    setQuestionDetection(null);
    const selectedSource = speechSourceRef.current;
    const sourceLabel = selectedSource === 'system-audio' ? 'system audio' : 'microphone';
    const startSpeech =
      selectedSource === 'system-audio' ? appApi.speech.startSystemAudio : appApi.speech.startMicrophone;

    setAnswer(`Listening from ${sourceLabel}. Click Stop Listening to finalize the transcript.`);
    const result = await startSpeech({
      model: 'Systran/faster-whisper-tiny.en',
      language: 'en',
      source: selectedSource
    });

    if (!result.ok) {
      setAnswer(result.message);
      showRecoverableError('Speech start failed', result.message, 'Check Windows input/output device routing, then try Start Listening again.');
      return;
    }

    setIsSpeechActive(true);
    setStatus('Listening');
  }

  function clearLiveQuestionTimer(): void {
    if (liveQuestionTimerRef.current !== null) {
      window.clearTimeout(liveQuestionTimerRef.current);
      liveQuestionTimerRef.current = null;
    }
  }

  function scheduleLiveQuestionDetection(liveTranscript: string): void {
    clearLiveQuestionTimer();

    if (modeRef.current !== 'AUTO' || speechAutoGenerationRequestedRef.current) {
      return;
    }

    liveQuestionTimerRef.current = window.setTimeout(() => {
      liveQuestionTimerRef.current = null;
      const detection = detectInterviewQuestion(transcriptRef.current);

      if (!detection.isQuestion || speechAutoGenerationRequestedRef.current) {
        return;
      }

      speechAutoGenerationRequestedRef.current = true;
      setQuestionDetection(detection);
      setConnectionMessage(`Question detected (${detection.confidence}). Generating answer automatically...`);
      void appApi.speech.stopMicrophone();
      void requestAnswer(answerDetailRef.current, transcriptRef.current || liveTranscript);
    }, 1800);
  }

  async function handleStopListening(): Promise<void> {
    clearStatusTimer();
    const result = await appApi.speech.stopMicrophone();

    if (!result.ok) {
      setIsSpeechActive(false);
      setAnswer(result.message);
      showRecoverableError('Speech stop failed', result.message, 'Wait a moment and try Stop Listening again.');
      return;
    }

    setStatus('Transcribing');
    setConnectionMessage('Stopping microphone and preparing final transcript...');
  }

  function handleClear(): void {
    clearStatusTimer();
    setQuestion('');
    setActiveQuestion('');
    setAnswer(EMPTY_CONTENT);
    setFollowUpQuestions([]);
    setTranscript('');
    setQuestionDetection(null);
    setStatus('Ready');
    clearErrorNotice();
  }

  function handleClearSessionMemory(): void {
    setHistory([]);
    setHistoryIndex(-1);
    setFollowUpQuestions([]);
    setConnectionMessage('Session memory cleared. Saved local history is unchanged.');
  }

  async function refreshPrivacyInfo(): Promise<void> {
    try {
      const result = await appApi.privacy.getInfo();

      setPrivacyInfo(result.info);

      if (!result.ok) {
        showRecoverableError('Privacy status unavailable', result.error ?? result.info.message, 'Local storage status may be incomplete.');
        return;
      }

      clearErrorNotice();
      setConnectionMessage(result.info.message);
    } catch {
      const privacyFailure = {
        ...DEFAULT_PRIVACY_INFO,
        status: 'error',
        message: 'Unable to read privacy status.'
      } satisfies PrivacyInfo;

      setPrivacyInfo(privacyFailure);
      showRecoverableError('Privacy status unavailable', privacyFailure.message, 'Restart the app if this repeats.');
    }
  }

  async function handleClearPrivateData(): Promise<void> {
    const shouldClear = window.confirm(
      'Clear all private local app data? This deletes saved answer history, personal knowledge, resume profile, and resets preferences. This cannot be undone.'
    );

    if (!shouldClear) {
      return;
    }

    clearErrorNotice();

    try {
      const result = await appApi.privacy.clearPrivateData();

      setPrivacyInfo(result.info);
      applySavedSettings(result.settings);
      setHistory([]);
      setHistoryIndex(-1);
      setFollowUpQuestions([]);
      setKnowledgeTitle('');
      setKnowledgeContent('');
      setResumeProfile(null);
      setResumeProfileContent('');
      setResumeProfileSummary({ name: '', targetRole: '', skills: '', projects: '', experience: '' });

      const [historyInfo, knowledgeInfo, resumeInfo] = await Promise.all([
        appApi.history.getInfo(),
        appApi.knowledge.getInfo(),
        appApi.resume.getInfo()
      ]);

      setHistoryDatabaseInfo(historyInfo);
      setKnowledgeDatabaseInfo(knowledgeInfo);
      setResumeProfileInfo(resumeInfo);

      if (!result.ok) {
        showRecoverableError('Clear private data incomplete', result.error ?? result.info.message, 'Review the Privacy section for stores that still need attention.');
        return;
      }

      setConnectionMessage('Private local data cleared. Preferences reset to defaults.');
      setStatus('Ready');
    } catch {
      showRecoverableError('Clear private data failed', 'Unable to clear private local data.', 'Try again from Settings -> Privacy.');
    }
  }

  function toggleSettings(): void {
    setSettingsOpen((isOpen) => !isOpen);
  }

  function closeMoreMenu(): void {
    if (moreMenuRef.current) {
      moreMenuRef.current.open = false;
    }
  }

  function handleDeleteLocalHistory(): void {
    const shouldDelete = window.confirm('Delete all saved local answer history? This cannot be undone.');

    if (!shouldDelete) {
      return;
    }

    setHistory([]);
    setHistoryIndex(-1);
    setFollowUpQuestions([]);
    appApi.history
      .clearAnswers()
      .then((result) => {
        setHistoryDatabaseInfo(result.info);
        if (result.ok) {
          clearErrorNotice();
          setConnectionMessage('Local answer history deleted.');
          return;
        }

        showRecoverableError('Delete history failed', result.error ?? result.info.message, 'Try again from Settings. Saved history may still exist.');
      })
      .catch(() => {
        const historyFailure = {
          status: 'error',
          message: 'Unable to clear local history database.',
          recordCount: 0
        } satisfies HistoryDatabaseInfo;

        setHistoryDatabaseInfo(historyFailure);
        showRecoverableError('Delete history failed', historyFailure.message, 'Session memory was cleared, but saved history could not be deleted.');
      });
  }

  function handleSaveKnowledge(): void {
    appApi.knowledge
      .saveSnippet({
        title: knowledgeTitle,
        content: knowledgeContent
      })
      .then((result) => {
        setKnowledgeDatabaseInfo(result.info);
        if (!result.ok) {
          showRecoverableError('Save knowledge failed', result.error ?? result.info.message, 'Check that both title and note are filled, then try again.');
          return;
        }

        clearErrorNotice();
        setConnectionMessage('Personal knowledge saved.');
        setKnowledgeTitle('');
        setKnowledgeContent('');
      })
      .catch(() => {
        const knowledgeFailure = {
          status: 'error',
          message: 'Unable to save personal knowledge.',
          snippetCount: knowledgeDatabaseInfo.snippetCount
        } satisfies KnowledgeDatabaseInfo;

        setKnowledgeDatabaseInfo(knowledgeFailure);
        showRecoverableError('Save knowledge failed', knowledgeFailure.message, 'Try saving again. Answers can continue without this snippet.');
      });
  }

  function handleClearKnowledge(): void {
    appApi.knowledge
      .clearSnippets()
      .then((result) => {
        setKnowledgeDatabaseInfo(result.info);
        if (result.ok) {
          clearErrorNotice();
          setConnectionMessage('Personal knowledge cleared.');
          return;
        }

        showRecoverableError('Clear knowledge failed', result.error ?? result.info.message, 'Try again from Settings.');
      })
      .catch(() => {
        const knowledgeFailure = {
          status: 'error',
          message: 'Unable to clear personal knowledge.',
          snippetCount: knowledgeDatabaseInfo.snippetCount
        } satisfies KnowledgeDatabaseInfo;

        setKnowledgeDatabaseInfo(knowledgeFailure);
        showRecoverableError('Clear knowledge failed', knowledgeFailure.message, 'Saved snippets may still be present.');
      });
  }

  function handleSaveResumeProfile(): void {
    appApi.resume
      .saveProfile(resumeProfileContent, resumeProfileSummary)
      .then((result) => {
        setResumeProfileInfo(result.info);
        if (!result.ok) {
          showRecoverableError('Save resume failed', result.error ?? result.info.message, 'Check the resume/profile notes and try again.');
          return;
        }

        clearErrorNotice();
        setConnectionMessage('Resume profile saved.');

        if (result.profile) {
          setResumeProfile(result.profile);
          setResumeProfileContent(result.profile.content);
          setResumeProfileSummary(result.profile.summary);
        }
      })
      .catch(() => {
        const resumeFailure = {
          status: 'error',
          message: 'Unable to save resume profile.',
          hasProfile: Boolean(resumeProfile)
        } satisfies ResumeProfileInfo;

        setResumeProfileInfo(resumeFailure);
        showRecoverableError('Save resume failed', resumeFailure.message, 'Try saving again. Resume-aware answers can continue with existing context.');
      });
  }

  function handleImportResumePdf(): void {
    appApi.resume
      .importPdf()
      .then((result) => {
        setResumeProfileInfo(result.info);
        if (result.cancelled) {
          return;
        }

        if (!result.ok) {
          showRecoverableError('Resume import failed', result.error ?? result.info.message, 'Choose a text-based PDF or paste the resume text below.');
          return;
        }

        clearErrorNotice();
        setConnectionMessage('Resume imported locally and will be used automatically for future answers.');
        if (result.profile) {
          setResumeProfile(result.profile);
          setResumeProfileContent(result.profile.content);
          setResumeProfileSummary(result.profile.summary);
        }
      })
      .catch(() => {
        showRecoverableError('Resume import failed', 'Unable to import the selected PDF.', 'Try again or paste the resume text below.');
      });
  }

  function handleClearResumeProfile(): void {
    const shouldClear = window.confirm('Clear the saved resume profile? This cannot be undone.');

    if (!shouldClear) {
      return;
    }

    appApi.resume
      .clearProfile()
      .then((result) => {
        setResumeProfileInfo(result.info);
        if (!result.ok) {
          showRecoverableError('Clear resume failed', result.error ?? result.info.message, 'Try again from Settings.');
          return;
        }

        clearErrorNotice();
        setConnectionMessage('Resume profile cleared.');
        setResumeProfile(null);
        setResumeProfileContent('');
        setResumeProfileSummary({ name: '', targetRole: '', skills: '', projects: '', experience: '' });
      })
      .catch(() => {
        const resumeFailure = {
          status: 'error',
          message: 'Unable to clear resume profile.',
          hasProfile: Boolean(resumeProfile)
        } satisfies ResumeProfileInfo;

        setResumeProfileInfo(resumeFailure);
        showRecoverableError('Clear resume failed', resumeFailure.message, 'Saved resume profile may still be present.');
      });
  }

  function handleShortAnswer(): void {
    handleSetAnswerLength('short');
    const retryQuestion = question.trim() || activeQuestion;
    if (retryQuestion) {
      requestAnswer('short', retryQuestion);
    }
  }

  function handleNormalAnswer(): void {
    handleSetAnswerLength('normal');
    const retryQuestion = question.trim() || activeQuestion;
    if (retryQuestion) {
      requestAnswer('normal', retryQuestion);
    }
  }

  function handleExpandAnswer(): void {
    handleSetAnswerLength('expanded');
    const retryQuestion = question.trim() || activeQuestion;
    if (retryQuestion) {
      requestAnswer('expanded', retryQuestion);
    }
  }

  function handlePrevious(): void {
    if (!canGoPrevious) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const record = history[nextIndex];
    setHistoryIndex(nextIndex);
    setActiveQuestion(record.question);
    setQuestion('');
    setAnswer(record.answer);
    setFollowUpQuestions(record.followUpQuestions ?? []);
    setAnswerDetail(record.detail);
    setAiSettings((currentSettings) => ({
      ...currentSettings,
      maxAnswerLength: record.detail
    }));
    setStatus('Answer Ready');
  }

  function handleNext(): void {
    if (!canGoNext) {
      return;
    }

    const nextIndex = historyIndex + 1;
    const record = history[nextIndex];
    setHistoryIndex(nextIndex);
    setActiveQuestion(record.question);
    setQuestion('');
    setAnswer(record.answer);
    setFollowUpQuestions(record.followUpQuestions ?? []);
    setAnswerDetail(record.detail);
    setAiSettings((currentSettings) => ({
      ...currentSettings,
      maxAnswerLength: record.detail
    }));
    setStatus('Answer Ready');
  }

  function handleUseFollowUp(followUpQuestion: string): void {
    setTranscript('');
    setActiveQuestion('');
    setQuestion(followUpQuestion);
    setQuestionDetection(detectInterviewQuestion(followUpQuestion));
    setConnectionMessage('Generating an answer for the selected follow-up...');
    void requestAnswer(answerDetailRef.current, followUpQuestion);
  }

  keyboardShortcutRef.current = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    const isEditableTarget = isEditableShortcutTarget(event.target);

    if (event.key === 'Escape') {
      event.preventDefault();

      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }

      appApi.window.hide();
      return;
    }

    if (event.ctrlKey && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleGenerate();
      return;
    }

    if (isEditableTarget) {
      return;
    }

    if (event.ctrlKey && key === 'k') {
      event.preventDefault();
      setSettingsOpen(false);
      window.requestAnimationFrame(() => questionInputRef.current?.focus());
      return;
    }

    if (event.ctrlKey && key === ',') {
      event.preventDefault();
      toggleSettings();
      return;
    }


    if (event.ctrlKey && key === 'backspace') {
      event.preventDefault();
      handleClear();
      return;
    }

    if (event.ctrlKey && key === '1') {
      event.preventDefault();
      handleSetAnswerLength('short');
      return;
    }

    if (event.ctrlKey && key === '2') {
      event.preventDefault();
      handleSetAnswerLength('normal');
      return;
    }

    if (event.ctrlKey && key === '3') {
      event.preventDefault();
      handleSetAnswerLength('expanded');
      return;
    }

    if (event.ctrlKey && key === 'arrowleft') {
      event.preventDefault();
      handlePrevious();
      return;
    }

    if (event.ctrlKey && key === 'arrowright') {
      event.preventDefault();
      handleNext();
      return;
    }

  };

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent): void => {
      keyboardShortcutRef.current(event);
    };

    window.addEventListener('keydown', handleKeyboardShortcut);

    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, []);

  return (
    <main
      className={`overlay-shell ${settingsOpen ? 'settings-mode' : ''}`}
      style={{ '--overlay-opacity': overlayOpacity } as React.CSSProperties}
    >
      <header className="titlebar">
        <div className="drag-region">
          <h1>Interview Coach</h1>
          <div className="status-line">
            <span className={`status-dot status-${STATUS_TONE[status]}`} aria-hidden="true" />
            <span>STATUS: {status}</span>
          </div>
        </div>
        <div className="window-actions" aria-label="Window controls">
          <button
            type="button"
            className={`protection-toggle ${isProtected ? 'protected' : 'unprotected'}`}
            aria-label={isProtected ? "Screen share protection on" : "Screen share protection off"}
            aria-pressed={isProtected}
            onClick={() => appApi.window.toggleProtection().then(setIsProtected)}
            title={isProtected ? "Hidden from screen share" : "Visible in screen share"}
          >
            {isProtected ? 'ON' : 'OFF'}
          </button>
          <button type="button" aria-label="Minimize" onClick={() => appApi.window.minimize()}>
            -
          </button>
          <button type="button" aria-label="Hide overlay" onClick={() => appApi.window.hide()}>
            x
          </button>
        </div>
      </header>

      {errorNotice ? (
        <section className="error-notice" role="alert" aria-label="Recoverable error">
          <div>
            <strong>{errorNotice.title}</strong>
            <p>{errorNotice.message}</p>
            {errorNotice.recovery ? <small>{errorNotice.recovery}</small> : null}
          </div>
          <button type="button" aria-label="Dismiss error" onClick={clearErrorNotice}>
            Dismiss
          </button>
        </section>
      ) : null}

      {settingsOpen ? (
        <aside className="settings-panel" aria-label="Settings">
          <section className="settings-section" aria-label="Privacy settings">
            <h2>Privacy & App</h2>
            <div className="privacy-panel">
              <div className="provider-status">
                <span>Local Data Folder</span>
                <strong>{privacyInfo.status === 'ready' ? 'Local only' : 'Needs attention'}</strong>
                <small>
                  {screenShareSafetyEnabled
                    ? 'Hidden while screen-sharing safety is on.'
                    : privacyInfo.localDataPath || privacyInfo.message}
                </small>
              </div>
              <div className="privacy-store-list">
                {privacyInfo.items.length ? (
                  privacyInfo.items.map((item) => (
                    <div key={item.id} className="privacy-store-item">
                      <span>{item.label}</span>
                      <strong>{screenShareSafetyEnabled ? 'Hidden in safety mode' : item.summary}</strong>
                    </div>
                  ))
                ) : (
                  <p className="privacy-empty">{privacyInfo.message}</p>
                )}
              </div>
              <div className="privacy-network-list">
                {privacyInfo.networkSummary.map((item) => (
                  <small key={item}>{item}</small>
                ))}
              </div>
              <div className="settings-action-row">
                <button type="button" className="test-ai-button" onClick={refreshPrivacyInfo}>
                  Refresh Privacy
                </button>
                <button type="button" className="test-ai-button danger-button" onClick={handleClearPrivateData}>
                  Clear Private Data
                </button>
              </div>
            </div>
            <div className="settings-grid">
              <label>
                Screen-Sharing Safety
                <select
                  value={screenShareSafetyEnabled ? 'enabled' : 'disabled'}
                  onChange={(event) => setScreenShareSafetyEnabled(event.target.value === 'enabled')}
                >
                  <option value="enabled">On</option>
                  <option value="disabled">Off</option>
                </select>
              </label>
              <label>
                App Opacity ({Math.round(overlayOpacity * 100)}%)
                <input
                  type="range"
                  min="0.45"
                  max="1"
                  step="0.05"
                  value={overlayOpacity}
                  onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                />
              </label>
              <div className="provider-status">
                <span>Scope</span>
                <strong>Practice only</strong>
                <small>Use this overlay only where interview practice assistance is permitted.</small>
              </div>
              <button type="button" className="test-ai-button" onClick={() => appApi.window.hide()}>
                Hide Overlay
              </button>
              <div className="provider-status">
                <span>Preferences</span>
                <strong>{settingsInfo.status === 'ready' ? 'Saved locally' : 'Needs attention'}</strong>
                <small>{settingsInfo.message}</small>
              </div>
              <button type="button" className="test-ai-button" onClick={handleResetPreferences}>
                Reset Preferences
              </button>
            </div>
          </section>

          <section className="settings-section" aria-label="Session settings">
            <h2>Audio & Session</h2>
            <div className="settings-grid">
              <label>
                Mode
                <select value={mode} onChange={(event) => setMode(event.target.value as InterviewMode)}>
                  <option value="MANUAL">Manual</option>
                  <option value="AUTO">Auto</option>
                </select>
              </label>
              <label>
                Audio Source
                <select
                  value={speechSource}
                  onChange={(event) => setSpeechSource(event.target.value as SpeechInputSource)}
                >
                  <option value="microphone">Microphone</option>
                  <option value="system-audio">System Audio</option>
                </select>
              </label>
              <label>
                Session Memory
                <select
                  value={memoryEnabled ? 'enabled' : 'disabled'}
                  onChange={(event) => setMemoryEnabled(event.target.value === 'enabled')}
                >
                  <option value="enabled">On</option>
                  <option value="disabled">Off</option>
                </select>
              </label>
              <div className="provider-status">
                <span>Speech Service</span>
                <strong>{speechInfo.engine}</strong>
                <small>{speechInfo.message}</small>
              </div>
              <button type="button" className="test-ai-button" onClick={handleCheckSpeechService}>
                Check Speech Service
              </button>
            </div>
          </section>

          <section className="settings-section" aria-label="Answer settings">
            <h2>AI & Answers</h2>
            <div className="settings-grid">
              <label>
                AI Provider
                <select
                  value={aiSettings.providerId}
                  onChange={(event) => handleProviderChange(event.target.value as AIProviderId)}
                >
                  <option value="ollama">Local Ollama</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="claude">Claude</option>
                </select>
              </label>
              <label>
                Length
                <select
                  value={aiSettings.maxAnswerLength}
                  onChange={(event) => {
                    handleSetAnswerLength(event.target.value as AnswerDetail);
                  }}
                >
                  <option value="short">Short</option>
                  <option value="normal">Normal</option>
                  <option value="expanded">Expanded</option>
                </select>
              </label>
              <label>
                Model
                <select
                  value={aiSettings.model}
                  onChange={(event) =>
                    setAiSettings((currentSettings) => ({
                      ...currentSettings,
                      model: event.target.value
                    }))
                  }
                >
                  {providerInfo.models?.length ? (
                    providerInfo.models.map((model) => (
                      <option key={model.name} value={model.name}>
                        {model.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No models found</option>
                  )}
                </select>
              </label>
              <label>
                Style
                <select
                  value={aiSettings.responseStyle}
                  onChange={(event) =>
                    setAiSettings((currentSettings) => ({
                      ...currentSettings,
                      responseStyle: event.target.value as AIResponseStyle
                    }))
                  }
                >
                  <option value="concise">Concise</option>
                  <option value="technical">Technical</option>
                  <option value="behavioral">Behavioral</option>
                </select>
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiSettings.temperature}
                  onChange={(event) =>
                    setAiSettings((currentSettings) => ({
                      ...currentSettings,
                      temperature: Number(event.target.value)
                    }))
                  }
                />
              </label>
              <div className="provider-status">
                <span>AI Provider</span>
                <strong>{providerInfo.name}</strong>
                <small>{providerInfo.message}</small>
              </div>
              <button type="button" className="test-ai-button" onClick={handleTestConnection}>
                {aiSettings.providerId === 'gemini' ? 'Test Gemini Connection' : 'Test AI Connection'}
              </button>
              {aiSettings.providerId === 'gemini' ? (
                <div className="gemini-key-panel full-setting">
                  <div className="provider-status">
                    <span>Gemini API Key</span>
                    <strong>{geminiSecretStatus.configured ? 'Saved locally' : 'Not saved'}</strong>
                    <small>{geminiSecretStatus.message}</small>
                  </div>
                  <label>
                    Key
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      value={geminiApiKeyInput}
                      placeholder={geminiSecretStatus.configured ? 'Saved key is hidden' : 'Paste Gemini API key here'}
                      onChange={(event) => setGeminiApiKeyInput(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="test-ai-button"
                    disabled={geminiKeyBusy || !geminiSecretStatus.encryptionAvailable}
                    onClick={handleSaveGeminiApiKey}
                  >
                    Save Key
                  </button>
                  <button
                    type="button"
                    className="test-ai-button danger-button"
                    disabled={geminiKeyBusy || !geminiSecretStatus.configured}
                    onClick={handleDeleteGeminiApiKey}
                  >
                    Delete Key
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="settings-section" aria-label="Memory and history settings">
            <h2>History</h2>
            <div className="settings-row">
              <div className="provider-status">
                <span>Local History</span>
                <strong>{historyDatabaseInfo.recordCount} saved</strong>
                <small>{historyDatabaseInfo.message}</small>
              </div>
              <div className="settings-action-row">
                <button type="button" className="test-ai-button" onClick={handleClearSessionMemory}>
                  Clear Session
                </button>
                <button type="button" className="test-ai-button danger-button" onClick={handleDeleteLocalHistory}>
                  Delete History
                </button>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-label="Resume profile settings">
            <h2>Resume</h2>
            <div className="settings-grid resume-profile-grid">
              <label>
                Resume Context
                <select
                  value={resumeProfileEnabled ? 'enabled' : 'disabled'}
                  onChange={(event) => setResumeProfileEnabled(event.target.value === 'enabled')}
                >
                  <option value="enabled">On</option>
                  <option value="disabled">Off</option>
                </select>
              </label>
              <div className="provider-status">
                <span>Imported Context</span>
                <strong>{resumeProfileInfo.hasProfile ? 'Ready' : 'Not imported'}</strong>
                <small>{resumeProfileInfo.hasProfile ? 'Used automatically to personalize answers.' : resumeProfileInfo.message}</small>
              </div>
              <button type="button" className="test-ai-button" onClick={handleImportResumePdf}>
                Import Resume PDF
              </button>
              <div className="resume-summary-heading full-setting">
                <strong>Candidate Profile Summary</strong>
                <small>Extracted locally from the resume. Review and edit before using it in answers.</small>
              </div>
              <label>
                Name
                <input
                  type="text"
                  value={resumeProfileSummary.name}
                  placeholder="Candidate name"
                  onChange={(event) => setResumeProfileSummary((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                Target Role
                <input
                  type="text"
                  value={resumeProfileSummary.targetRole}
                  placeholder="Example: Generative AI Engineer"
                  onChange={(event) => setResumeProfileSummary((current) => ({ ...current, targetRole: event.target.value }))}
                />
              </label>
              <label className="full-setting">
                Skills
                <textarea
                  value={resumeProfileSummary.skills}
                  placeholder="Key technical skills extracted from the resume"
                  onChange={(event) => setResumeProfileSummary((current) => ({ ...current, skills: event.target.value }))}
                />
              </label>
              <label className="full-setting">
                Projects
                <textarea
                  value={resumeProfileSummary.projects}
                  placeholder="Relevant projects and contributions"
                  onChange={(event) => setResumeProfileSummary((current) => ({ ...current, projects: event.target.value }))}
                />
              </label>
              <label className="full-setting">
                Experience
                <textarea
                  value={resumeProfileSummary.experience}
                  placeholder="Relevant experience and responsibilities"
                  onChange={(event) => setResumeProfileSummary((current) => ({ ...current, experience: event.target.value }))}
                />
              </label>
              <label className="full-setting">
                Resume Source Text
                <textarea
                  className="profile-textarea"
                  value={resumeProfileContent}
                  placeholder="Import a text-based resume PDF, or paste concise resume, stack, projects, role, and experience details here."
                  onChange={(event) => setResumeProfileContent(event.target.value)}
                />
              </label>
              <button type="button" className="test-ai-button" onClick={handleSaveResumeProfile}>
                Save Edited Text
              </button>
              <button type="button" className="test-ai-button danger-button" onClick={handleClearResumeProfile}>
                Clear Resume
              </button>
            </div>
          </section>

          <section className="settings-section" aria-label="Personal knowledge settings">
            <h2>Personal Knowledge Notes</h2>
            <div className="settings-grid personal-knowledge-grid">
              <label>
                Personal Knowledge
                <select
                  value={personalKnowledgeEnabled ? 'enabled' : 'disabled'}
                  onChange={(event) => setPersonalKnowledgeEnabled(event.target.value === 'enabled')}
                >
                  <option value="enabled">On</option>
                  <option value="disabled">Off</option>
                </select>
              </label>
              <div className="provider-status">
                <span>Knowledge Store</span>
                <strong>{knowledgeDatabaseInfo.snippetCount} snippets</strong>
                <small>{knowledgeDatabaseInfo.message}</small>
              </div>
              <label>
                Knowledge Title
                <input
                  type="text"
                  value={knowledgeTitle}
                  placeholder="Example: GenAI project context"
                  onChange={(event) => setKnowledgeTitle(event.target.value)}
                />
              </label>
              <label className="full-setting">
                Knowledge Note
                <textarea
                  value={knowledgeContent}
                  placeholder="Save project, resume, stack, domain, or answer preference details here."
                  onChange={(event) => setKnowledgeContent(event.target.value)}
                />
              </label>
              <button type="button" className="test-ai-button" onClick={handleSaveKnowledge}>
                Save Knowledge
              </button>
              <button type="button" className="test-ai-button danger-button" onClick={handleClearKnowledge}>
                Clear Knowledge
              </button>
            </div>
          </section>

          {connectionMessage ? <p className="connection-message">{connectionMessage}</p> : null}
        </aside>
      ) : null}

      {!settingsOpen ? (
        <>
          <section className={`content-grid ${screenShareSafetyEnabled ? 'safety-content-grid' : ''}`}>
            <div className="section-block answer-block">
              <div
                className="answer-reader"
                ref={answerContentRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

                  if (distanceFromBottom <= 8) {
                    setAnswerFullyRead(true);
                  }
                }}
              >
                <pre>{answer}</pre>
                {answerFullyRead && followUpQuestions.length ? (
                  <section className="follow-up-panel" aria-label="Likely follow-up questions">
                    <h3>LIKELY FOLLOW-UPS</h3>
                    <div className="follow-up-list">
                      {followUpQuestions.map((followUpQuestion) => (
                        <button
                          key={followUpQuestion}
                          type="button"
                          onClick={() => handleUseFollowUp(followUpQuestion)}
                        >
                          {followUpQuestion}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {answerFullyRead ? (
                  <div className="history-meta">
                    {historyIndex >= 0 ? (
                      <span>
                        {historyIndex + 1} / {history.length} - {history[historyIndex]?.category.toUpperCase()} -{' '}
                        {history[historyIndex]?.createdAt}
                      </span>
                    ) : (
                      <span>
                        {mode} mode - {providerInfo.name}: {providerInfo.status} - memory {memoryEnabled ? history.length : 'off'} -
                        resume {resumeProfileEnabled ? (resumeProfileInfo.hasProfile ? 'saved' : 'empty') : 'off'} - knowledge{' '}
                        {personalKnowledgeEnabled ? knowledgeDatabaseInfo.snippetCount : 'off'}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="answer-heading">
                <h2>ANSWER</h2>
                <div className="answer-actions">
                  <label className="length-select answer-length-select">
                    <span>Length</span>
                    <select
                      value={answerDetail}
                      disabled={isGenerating}
                      aria-label="Answer length"
                      onChange={(event) => handleSetAnswerLength(event.target.value as AnswerDetail)}
                    >
                      <option value="short">Short</option>
                      <option value="normal">Normal</option>
                      <option value="expanded">Detailed</option>
                    </select>
                  </label>
                  <select
                    className="regenerate-select"
                    aria-label="Regenerate answer"
                    defaultValue=""
                    disabled={isGenerating || !activeQuestion}
                    onChange={(event) => {
                      const nextLength = event.target.value as AnswerDetail | '';
                      event.currentTarget.value = '';

                      if (nextLength === 'short') {
                        handleShortAnswer();
                      } else if (nextLength === 'normal') {
                        handleNormalAnswer();
                      } else if (nextLength === 'expanded') {
                        handleExpandAnswer();
                      }
                    }}
                  >
                    <option value="">Regenerate…</option>
                    <option value="short">Make shorter</option>
                    <option value="normal">Make balanced</option>
                    <option value="expanded">Make detailed</option>
                  </select>
                  <button
                    type="button"
                    disabled={!canGoPrevious || isGenerating}
                    aria-keyshortcuts="Control+ArrowLeft"
                    aria-label="Previous answer"
                    title="Previous answer"
                    onClick={handlePrevious}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    disabled={!canGoNext || isGenerating}
                    aria-keyshortcuts="Control+ArrowRight"
                    aria-label="Next answer"
                    title="Next answer"
                    onClick={handleNext}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            {screenShareSafetyEnabled ? (
              <div className="safety-session-panel" aria-label="Screen-sharing safety notice">
                <div>
                  <strong>Screen-sharing safety on</strong>
                  <span>Practice scope active. Private local paths are hidden in Settings.</span>
                </div>
                <button type="button" onClick={() => appApi.window.hide()}>
                  Hide Overlay
                </button>
              </div>
            ) : null}

            <div className="section-block question-block" aria-label="Live question">
              <h2>{isSpeechActive ? 'LIVE QUESTION' : 'CURRENT QUESTION'}</h2>
              <p>{transcript || questionPreview}</p>
              {status === 'Listening' || status === 'Transcribing' ? (
                <small className={`detection-note ${speechSignalLevel >= 0.00005 ? 'detected' : ''}`}>
                  {speechSignalLevel >= 0.00005
                    ? 'Audio signal detected. Transcript should appear shortly.'
                    : speechSource === 'system-audio'
                      ? 'No system-audio signal yet. Play sound through the active Windows speaker.'
                      : 'No microphone signal yet. For a video, select System Audio in Settings.'}
                </small>
              ) : null}
              {questionDetection ? (
                <small className={`detection-note ${questionDetection.isQuestion ? 'detected' : ''}`}>
                  {questionDetection.isQuestion
                    ? `Detected question (${questionDetection.confidence})`
                    : 'No clear question detected'}
                </small>
              ) : null}
            </div>
          </section>
        </>
      ) : null}

      <nav className="control-strip" aria-label="Interview controls">
        <div className="segmented-control" aria-label="Response mode">
          <button
            type="button"
            className={mode === 'AUTO' ? 'selected' : ''}
            aria-pressed={mode === 'AUTO'}
            onClick={() => setMode('AUTO')}
          >
            AUTO
          </button>
          <button
            type="button"
            className={mode === 'MANUAL' ? 'selected' : ''}
            aria-pressed={mode === 'MANUAL'}
            onClick={() => setMode('MANUAL')}
          >
            MANUAL
          </button>
        </div>
        <button
          type="button"
          className={`listen-button ${isSpeechActive ? 'listening' : ''}`}
          onClick={isSpeechActive ? handleStopListening : handleStartListening}
        >
          <span className="listen-label-full">
            {isSpeechActive
              ? 'Stop listening'
              : speechSource === 'system-audio'
                ? 'Start system audio'
                : 'Start listening'}
          </span>
          <span className="listen-label-compact">{isSpeechActive ? 'Stop' : 'Listen'}</span>
        </button>
        <details ref={moreMenuRef} className="more-menu">
          <summary>More</summary>
          <div className="more-menu-panel">
            <label className="opacity-control">
              <span>Opacity {Math.round(overlayOpacity * 100)}%</span>
              <input
                type="range"
                min="0.45"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(event) => setOverlayOpacity(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={() => {
              closeMoreMenu();
              handleClear();
            }}>
              Clear session
            </button>
            <button type="button" aria-keyshortcuts="Control+," onClick={() => {
              closeMoreMenu();
              toggleSettings();
            }}>
              Settings
            </button>
          </div>
        </details>
      </nav>

      {!settingsOpen ? (
        <footer className="composer">
          <div className="composer-row">
            <textarea
              ref={questionInputRef}
              aria-label="Type an interview question"
              placeholder="Type an interview question..."
              value={question}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleGenerate();
                }
              }}
              onChange={(event) => {
                setTranscript('');
                setQuestion(event.target.value);
              }}
            />
            <button type="button" disabled={!canGenerate} aria-keyshortcuts="Control+Enter" onClick={handleGenerate}>
              {isGenerating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </footer>
      ) : null}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
