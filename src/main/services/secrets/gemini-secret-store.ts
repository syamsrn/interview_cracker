import { safeStorage } from 'electron';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GeminiSecretCommandResult, GeminiSecretStatus } from '../../../shared/gemini';

interface GeminiSecretDocument {
  schemaVersion: 1;
  encryptedApiKey: string;
  updatedAt: string;
}

export class GeminiSecretStore {
  constructor(private readonly secretPath: string) {}

  async getStatus(): Promise<GeminiSecretStatus> {
    const encryptionAvailable = safeStorage.isEncryptionAvailable();
    const configured = await this.hasEncryptedApiKey();

    return {
      configured,
      encryptionAvailable,
      message: configured
        ? 'Gemini API key is saved locally with Electron safeStorage.'
        : encryptionAvailable
          ? 'Gemini API key is not saved yet.'
          : 'Secure local encryption is unavailable in this Windows session.'
    };
  }

  async saveApiKey(apiKey: string): Promise<GeminiSecretCommandResult> {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      return this.failure('Gemini API key is required.');
    }

    if (!safeStorage.isEncryptionAvailable()) {
      return this.failure('Secure local encryption is unavailable.');
    }

    try {
      await mkdir(dirname(this.secretPath), { recursive: true });
      const encryptedApiKey = safeStorage.encryptString(trimmedKey).toString('base64');
      const tempPath = `${this.secretPath}.tmp`;

      await writeFile(
        tempPath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            encryptedApiKey,
            updatedAt: new Date().toISOString()
          } satisfies GeminiSecretDocument,
          null,
          2
        )}\n`,
        'utf8'
      );
      await rename(tempPath, this.secretPath);

      return {
        ok: true,
        status: await this.getStatus()
      };
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : 'Unable to save Gemini API key.');
    }
  }

  async deleteApiKey(): Promise<GeminiSecretCommandResult> {
    try {
      await unlink(this.secretPath);
    } catch (error) {
      if (!isFileMissingError(error)) {
        return this.failure(error instanceof Error ? error.message : 'Unable to delete Gemini API key.');
      }
    }

    return {
      ok: true,
      status: await this.getStatus()
    };
  }

  async getApiKey(): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }

    try {
      const document = await this.readDocument();
      return safeStorage.decryptString(Buffer.from(document.encryptedApiKey, 'base64')).trim() || null;
    } catch {
      return null;
    }
  }

  private async hasEncryptedApiKey(): Promise<boolean> {
    try {
      const document = await this.readDocument();
      return Boolean(document.encryptedApiKey);
    } catch {
      return false;
    }
  }

  private async readDocument(): Promise<GeminiSecretDocument> {
    const content = await readFile(this.secretPath, 'utf8');
    const parsed = JSON.parse(content) as Partial<GeminiSecretDocument>;

    if (parsed.schemaVersion !== 1 || typeof parsed.encryptedApiKey !== 'string' || !parsed.encryptedApiKey) {
      throw new Error('Gemini secret file is invalid.');
    }

    return {
      schemaVersion: 1,
      encryptedApiKey: parsed.encryptedApiKey,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
    };
  }

  private async failure(error: string): Promise<GeminiSecretCommandResult> {
    return {
      ok: false,
      status: await this.getStatus(),
      error
    };
  }
}

function isFileMissingError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
