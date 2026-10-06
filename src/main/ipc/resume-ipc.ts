import { dialog, ipcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import { PDFParse } from 'pdf-parse';
import type { ResumeProfileSummary } from '../../shared/resume';
import { ResumeProfileDatabase } from '../services/resume/resume-profile-database';

export function registerResumeIpcHandlers(resumeProfileDatabase: ResumeProfileDatabase): void {
  ipcMain.handle('resume:get-info', () => resumeProfileDatabase.getInfo());
  ipcMain.handle('resume:get-profile', () => resumeProfileDatabase.getProfile());
  ipcMain.handle('resume:clear-profile', () => resumeProfileDatabase.clearProfile());

  ipcMain.handle('resume:import-pdf', async () => {
    const selection = await dialog.showOpenDialog({
      title: 'Import resume PDF',
      properties: ['openFile'],
      filters: [{ name: 'PDF files', extensions: ['pdf'] }]
    });

    if (selection.canceled || !selection.filePaths[0]) {
      return {
        ok: false,
        info: await resumeProfileDatabase.getInfo(),
        cancelled: true
      };
    }

    try {
      const file = await readFile(selection.filePaths[0]);

      if (!file.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
        throw new Error('The selected file is not a valid PDF.');
      }

      const parser = new PDFParse({ data: new Uint8Array(file) });
      const result = await parser.getText();
      await parser.destroy();
      const content = result.text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

      if (!content) {
        throw new Error('No readable text was found in this PDF. Use a text-based resume PDF or paste the content manually.');
      }

      return resumeProfileDatabase.saveProfile(content);
    } catch (error) {
      return {
        ok: false,
        info: await resumeProfileDatabase.getInfo(),
        error: error instanceof Error ? error.message : 'Unable to import the resume PDF.'
      };
    }
  });

  ipcMain.handle('resume:save-profile', (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      return resumeProfileDatabase.getInfo().then((info) => ({
        ok: false,
        info,
        error: 'Invalid resume profile payload.'
      }));
    }

    const record = payload as Record<string, unknown>;

    if (typeof record.content !== 'string') {
      return resumeProfileDatabase.getInfo().then((info) => ({
        ok: false,
        info,
        error: 'Resume profile content is required.'
      }));
    }

    const summary = isResumeProfileSummary(record.summary) ? record.summary : undefined;

    return resumeProfileDatabase.saveProfile(record.content, summary);
  });
}

function isResumeProfileSummary(value: unknown): value is Partial<ResumeProfileSummary> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}
