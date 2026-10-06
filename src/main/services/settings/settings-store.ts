import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AppSettings, SettingsCommandResult, SettingsResult, SettingsStoreInfo } from '../../../shared/settings';

interface SettingsDocument {
  schemaVersion: 1;
  settings: AppSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'MANUAL',
  speechSource: 'microphone',
  memoryEnabled: true,
  personalKnowledgeEnabled: true,
  resumeProfileEnabled: true,
  screenShareSafetyEnabled: false,
  overlayOpacity: 0.92,
  aiProviderId: 'ollama',
  aiModel: '',
  temperature: 0.3,
  answerLength: 'normal',
  responseStyle: 'concise'
};

const VALID_MODES = new Set(['AUTO', 'MANUAL']);
const VALID_SPEECH_SOURCES = new Set(['microphone', 'system-audio']);
const VALID_PROVIDER_IDS = new Set(['ollama', 'openai', 'gemini', 'claude']);
const VALID_LENGTHS = new Set(['short', 'normal', 'expanded']);
const VALID_RESPONSE_STYLES = new Set(['concise', 'technical', 'behavioral']);

export class SettingsStore {
  constructor(private readonly settingsPath: string) {}

  async getSettings(): Promise<SettingsResult> {
    try {
      const settings = await this.readSettings();

      return {
        ok: true,
        settings,
        info: this.createReadyInfo('Settings are ready.')
      };
    } catch (error) {
      return {
        ok: false,
        settings: { ...DEFAULT_SETTINGS },
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to read settings.'
      };
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<SettingsCommandResult> {
    try {
      const currentSettings = await this.readSettings();
      const nextSettings = sanitizeSettings({
        ...currentSettings,
        ...settings
      });

      await this.writeSettings(nextSettings);

      return {
        ok: true,
        settings: nextSettings,
        info: this.createReadyInfo('Settings saved locally.')
      };
    } catch (error) {
      return {
        ok: false,
        settings: { ...DEFAULT_SETTINGS },
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to save settings.'
      };
    }
  }

  async resetSettings(): Promise<SettingsCommandResult> {
    try {
      const settings = { ...DEFAULT_SETTINGS };

      await this.writeSettings(settings);

      return {
        ok: true,
        settings,
        info: this.createReadyInfo('Settings reset to defaults.')
      };
    } catch (error) {
      return {
        ok: false,
        settings: { ...DEFAULT_SETTINGS },
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to reset settings.'
      };
    }
  }

  private async readSettings(): Promise<AppSettings> {
    try {
      const content = await readFile(this.settingsPath, 'utf8');
      const parsed = JSON.parse(content) as Partial<SettingsDocument>;

      if (parsed.schemaVersion !== 1 || typeof parsed.settings !== 'object' || parsed.settings === null) {
        return { ...DEFAULT_SETTINGS };
      }

      return sanitizeSettings(parsed.settings);
    } catch (error) {
      if (isFileMissingError(error)) {
        await this.writeSettings(DEFAULT_SETTINGS);
        return { ...DEFAULT_SETTINGS };
      }

      throw error;
    }
  }

  private async writeSettings(settings: AppSettings): Promise<void> {
    await mkdir(dirname(this.settingsPath), {
      recursive: true
    });

    const tempPath = `${this.settingsPath}.tmp`;
    await writeFile(
      tempPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          settings
        } satisfies SettingsDocument,
        null,
        2
      )}\n`,
      'utf8'
    );
    await rename(tempPath, this.settingsPath);
  }

  private createReadyInfo(message: string): SettingsStoreInfo {
    return {
      status: 'ready',
      message,
      path: this.settingsPath
    };
  }

  private createErrorInfo(error: unknown): SettingsStoreInfo {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Settings store is unavailable.',
      path: this.settingsPath
    };
  }
}

export function getDefaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS };
}

function sanitizeSettings(settings: Partial<AppSettings>): AppSettings {
  return {
    mode: VALID_MODES.has(settings.mode ?? '') ? settings.mode as AppSettings['mode'] : DEFAULT_SETTINGS.mode,
    speechSource: VALID_SPEECH_SOURCES.has(settings.speechSource ?? '')
      ? settings.speechSource as AppSettings['speechSource']
      : DEFAULT_SETTINGS.speechSource,
    memoryEnabled: typeof settings.memoryEnabled === 'boolean' ? settings.memoryEnabled : DEFAULT_SETTINGS.memoryEnabled,
    personalKnowledgeEnabled:
      typeof settings.personalKnowledgeEnabled === 'boolean'
        ? settings.personalKnowledgeEnabled
        : DEFAULT_SETTINGS.personalKnowledgeEnabled,
    resumeProfileEnabled:
      typeof settings.resumeProfileEnabled === 'boolean'
        ? settings.resumeProfileEnabled
        : DEFAULT_SETTINGS.resumeProfileEnabled,
    screenShareSafetyEnabled:
      typeof settings.screenShareSafetyEnabled === 'boolean'
        ? settings.screenShareSafetyEnabled
        : DEFAULT_SETTINGS.screenShareSafetyEnabled,
    overlayOpacity: sanitizeOpacity(settings.overlayOpacity),
    aiProviderId: VALID_PROVIDER_IDS.has(settings.aiProviderId ?? '')
      ? settings.aiProviderId as AppSettings['aiProviderId']
      : DEFAULT_SETTINGS.aiProviderId,
    aiModel: typeof settings.aiModel === 'string' ? settings.aiModel.trim().slice(0, 120) : DEFAULT_SETTINGS.aiModel,
    temperature: sanitizeTemperature(settings.temperature),
    answerLength: VALID_LENGTHS.has(settings.answerLength ?? '')
      ? settings.answerLength as AppSettings['answerLength']
      : DEFAULT_SETTINGS.answerLength,
    responseStyle: VALID_RESPONSE_STYLES.has(settings.responseStyle ?? '')
      ? settings.responseStyle as AppSettings['responseStyle']
      : DEFAULT_SETTINGS.responseStyle
  };
}

function sanitizeTemperature(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.temperature;
  }

  return Math.min(1, Math.max(0, Math.round(value * 10) / 10));
}

function sanitizeOpacity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SETTINGS.overlayOpacity;
  }

  return Math.min(1, Math.max(0.45, Math.round(value * 100) / 100));
}

function isFileMissingError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
