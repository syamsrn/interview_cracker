import { ipcMain } from 'electron';
import { PrivacyService } from '../services/privacy/privacy-service';

export function registerPrivacyIpcHandlers(privacyService: PrivacyService): void {
  ipcMain.handle('privacy:get-info', () => privacyService.getInfo());
  ipcMain.handle('privacy:clear-private-data', () => privacyService.clearPrivateData());
}
