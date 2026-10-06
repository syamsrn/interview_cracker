import { ipcMain } from 'electron';
import { GeminiSecretStore } from '../services/secrets/gemini-secret-store';

export function registerGeminiIpcHandlers(geminiSecretStore: GeminiSecretStore): void {
  ipcMain.handle('gemini:get-secret-status', () => geminiSecretStore.getStatus());

  ipcMain.handle('gemini:save-api-key', (_event, payload: unknown) => {
    if (typeof payload !== 'string' || payload.trim().length < 10 || payload.length > 4096) {
      return geminiSecretStore.saveApiKey('');
    }

    return geminiSecretStore.saveApiKey(payload);
  });

  ipcMain.handle('gemini:delete-api-key', () => geminiSecretStore.deleteApiKey());
}
