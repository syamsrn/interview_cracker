import { ipcMain } from 'electron';
import type { SpeechStartRequest } from '../../shared/speech';
import { SpeechService } from '../services/speech/speech-service';

export function registerSpeechIpcHandlers(speechService: SpeechService): void {
  ipcMain.handle('speech:get-info', () => speechService.getInfo());

  ipcMain.handle('speech:start-microphone', (event, payload: unknown) => {
    const request = parseSpeechStartRequest(payload);

    return speechService.startMicrophoneTranscription(request, (speechEvent) => {
      event.sender.send('speech:event', speechEvent);
    });
  });

  ipcMain.handle('speech:start-system-audio', (event, payload: unknown) => {
    const request = parseSpeechStartRequest(payload);

    return speechService.startSystemAudioTranscription(request, (speechEvent) => {
      event.sender.send('speech:event', speechEvent);
    });
  });

  ipcMain.handle('speech:stop-microphone', () => speechService.stopMicrophoneTranscription());
}

function parseSpeechStartRequest(payload: unknown): SpeechStartRequest {
  if (typeof payload !== 'object' || payload === null) {
    return {
      model: 'Systran/faster-whisper-tiny.en',
      language: 'en'
    };
  }

  const record = payload as Record<string, unknown>;

  return {
    model: typeof record.model === 'string' ? record.model : 'Systran/faster-whisper-tiny.en',
    language: typeof record.language === 'string' ? record.language : 'en',
    deviceName: typeof record.deviceName === 'string' ? record.deviceName : undefined
  };
}
