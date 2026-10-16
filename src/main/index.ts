import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron';
import { join } from 'node:path';
import { registerAIIpcHandlers } from './ipc/ai-ipc';
import { registerGeminiIpcHandlers } from './ipc/gemini-ipc';
import { registerHistoryIpcHandlers } from './ipc/history-ipc';
import { registerKnowledgeIpcHandlers } from './ipc/knowledge-ipc';
import { registerPrivacyIpcHandlers } from './ipc/privacy-ipc';
import { registerResumeIpcHandlers } from './ipc/resume-ipc';
import { registerSettingsIpcHandlers } from './ipc/settings-ipc';
import { registerSpeechIpcHandlers } from './ipc/speech-ipc';
import { AIService } from './services/ai/ai-service';
import { HistoryDatabase } from './services/history/history-database';
import { KnowledgeDatabase } from './services/knowledge/knowledge-database';
import { PrivacyService } from './services/privacy/privacy-service';
import { ResumeProfileDatabase } from './services/resume/resume-profile-database';
import { GeminiSecretStore } from './services/secrets/gemini-secret-store';
import { SettingsStore } from './services/settings/settings-store';
import { SpeechService } from './services/speech/speech-service';

app.setName('interview_app');

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

const OVERLAY_WIDTH = 650;
const OVERLAY_HEIGHT = 520;
const OVERLAY_MARGIN = 24;

let mainWindow: BrowserWindow | null = null;
let protectionEnabled = true;
let isQuitting = false;
const speechService = new SpeechService();

app.on('second-instance', () => {
  if (!mainWindow) {
    return;
  }

  mainWindow.show();
  mainWindow.focus();
});

process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', formatUnknownError(error));
});

process.on('unhandledRejection', (reason) => {
  console.error('[main] Unhandled promise rejection:', formatUnknownError(reason));
});

function getInitialOverlayBounds(): Electron.Rectangle {
  const { workArea } = screen.getPrimaryDisplay();

  return {
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: workArea.x + workArea.width - OVERLAY_WIDTH - OVERLAY_MARGIN,
    y: workArea.y + OVERLAY_MARGIN
  };
}

function toggleOverlayVisibility(): void {
  if (!mainWindow) {
    createMainWindow();
    return;
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    return;
  }

  mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    ...getInitialOverlayBounds(),
    minWidth: 300,
    minHeight: 360,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.setSkipTaskbar(true);
  mainWindow.setContentProtection(protectionEnabled);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    console.error('[renderer] Failed to load:', {
      errorCode,
      errorDescription,
      validatedUrl
    });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] Render process gone:', details);
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;

  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl);
    return;
  }

  mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
}

function registerIpcHandlers(
  userDataPath: string,
  aiService: AIService,
  historyDatabase: HistoryDatabase,
  knowledgeDatabase: KnowledgeDatabase,
  resumeProfileDatabase: ResumeProfileDatabase,
  settingsStore: SettingsStore,
  geminiSecretStore: GeminiSecretStore
): void {
  ipcMain.handle('overlay:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('overlay:hide', () => {
    mainWindow?.hide();
  });


  ipcMain.handle('overlay:toggle', () => {
    toggleOverlayVisibility();
  });

  ipcMain.handle('overlay:toggle-protection', () => {
    protectionEnabled = !protectionEnabled;
    mainWindow?.setContentProtection(protectionEnabled);
    return protectionEnabled;
  });

  ipcMain.handle('overlay:get-protection-status', () => protectionEnabled);

  registerAIIpcHandlers(aiService);
  registerGeminiIpcHandlers(geminiSecretStore);
  registerSpeechIpcHandlers(speechService);
  registerHistoryIpcHandlers(historyDatabase);
  registerKnowledgeIpcHandlers(knowledgeDatabase);
  registerResumeIpcHandlers(resumeProfileDatabase);
  registerSettingsIpcHandlers(settingsStore);
  registerPrivacyIpcHandlers(
    new PrivacyService(userDataPath, historyDatabase, knowledgeDatabase, resumeProfileDatabase, settingsStore)
  );
}

if (hasSingleInstanceLock) {
  app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const historyDatabase = new HistoryDatabase(join(userDataPath, 'interview-coach-history.json'));
  const knowledgeDatabase = new KnowledgeDatabase(join(userDataPath, 'interview-coach-knowledge.json'));
  const resumeProfileDatabase = new ResumeProfileDatabase(join(userDataPath, 'interview-coach-resume.json'));
  const settingsStore = new SettingsStore(join(userDataPath, 'interview-coach-settings.json'));
  const geminiSecretStore = new GeminiSecretStore(join(userDataPath, 'interview-coach-gemini-key.json'));
  const aiService = new AIService(geminiSecretStore);

  registerIpcHandlers(
    userDataPath,
    aiService,
    historyDatabase,
    knowledgeDatabase,
    resumeProfileDatabase,
    settingsStore,
    geminiSecretStore
  );
  createMainWindow();
  const shortcutRegistered = globalShortcut.register('CommandOrControl+Shift+I', toggleOverlayVisibility);

  if (!shortcutRegistered) {
    console.warn('[main] Unable to register Ctrl+Shift+I overlay shortcut.');
  }

  const protectionShortcutRegistered = globalShortcut.register('CommandOrControl+Shift+H', () => {
  protectionEnabled = !protectionEnabled;
  mainWindow?.setContentProtection(protectionEnabled);
  mainWindow?.webContents.send('protection-status-changed', protectionEnabled);
  });

  if (!protectionShortcutRegistered) {
    console.warn('[main] Unable to register Ctrl+Shift+H protection shortcut.');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}
