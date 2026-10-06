export type SpeechEngineId = 'faster-whisper';

export type SpeechInputSource = 'microphone' | 'system-audio';

export type SpeechServiceStatus =
  | 'not-configured'
  | 'python-missing'
  | 'python-incompatible'
  | 'missing-dependencies'
  | 'ready'
  | 'error';

export interface SpeechServiceInfo {
  engine: SpeechEngineId;
  status: SpeechServiceStatus;
  message: string;
  pythonPath?: string;
  pythonVersion?: string;
  setupHint?: string;
}

export interface SpeechStartRequest {
  model: string;
  language?: string;
  deviceName?: string;
  source?: SpeechInputSource;
}

export interface SpeechCommandResult {
  ok: boolean;
  message: string;
  info?: SpeechServiceInfo;
}

export type SpeechTranscriptEventType = 'status' | 'level' | 'partial' | 'final' | 'error';

export interface SpeechTranscriptEvent {
  type: SpeechTranscriptEventType;
  message?: string;
  text?: string;
  level?: number;
}
