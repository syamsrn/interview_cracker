import { ipcMain } from 'electron';
import type { AppSettings, SettingsCommandResult } from '../../shared/settings';
import { SettingsStore } from '../services/settings/settings-store';

export function registerSettingsIpcHandlers(settingsStore: SettingsStore): void {
  ipcMain.handle('settings:get', () => settingsStore.getSettings());

  ipcMain.handle('settings:save', (_event, payload: unknown): Promise<SettingsCommandResult> => {
    if (typeof payload !== 'object' || payload === null) {
      return settingsStore.saveSettings({});
    }

    return settingsStore.saveSettings(payload as Partial<AppSettings>);
  });

  ipcMain.handle('settings:reset', () => settingsStore.resetSettings());
}
