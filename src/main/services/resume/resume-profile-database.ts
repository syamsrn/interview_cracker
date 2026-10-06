import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  ResumeCommandResult,
  ResumeProfile,
  ResumeProfileInfo,
  ResumeProfileResult,
  ResumeProfileSummary
} from '../../../shared/resume';
import { sanitizeResumeProfileSummary } from './resume-profile-summary';

interface ResumeProfileDocument {
  schemaVersion: 1;
  profile: ResumeProfile | null;
}

const MAX_PROFILE_LENGTH = 12000;

export class ResumeProfileDatabase {
  constructor(private readonly databasePath: string) {}

  async getInfo(): Promise<ResumeProfileInfo> {
    try {
      const database = await this.readDatabase();

      return this.createReadyInfo(
        database.profile ? 'Resume profile is ready.' : 'No resume profile saved yet.',
        Boolean(database.profile)
      );
    } catch (error) {
      return this.createErrorInfo(error);
    }
  }

  async getProfile(): Promise<ResumeProfileResult> {
    try {
      const database = await this.readDatabase();

      return {
        ok: true,
        profile: database.profile ?? undefined,
        info: this.createReadyInfo(
          database.profile ? 'Resume profile is ready.' : 'No resume profile saved yet.',
          Boolean(database.profile)
        )
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to read resume profile.'
      };
    }
  }

  async saveProfile(content: string, summary?: Partial<ResumeProfileSummary>): Promise<ResumeCommandResult> {
    try {
      const database = await this.readDatabase();
      const sanitizedContent = sanitizeProfileContent(content);

      if (!sanitizedContent) {
        const info = this.createReadyInfo('Resume profile content is required.', Boolean(database.profile));
        return {
          ok: false,
          info,
          error: info.message
        };
      }

      const now = new Date().toISOString();
      const profile: ResumeProfile = {
        content: sanitizedContent,
        summary: sanitizeResumeProfileSummary(summary ?? database.profile?.summary, sanitizedContent),
        createdAt: database.profile?.createdAt ?? now,
        updatedAt: now
      };

      await this.writeDatabase({
        schemaVersion: 1,
        profile
      });

      return {
        ok: true,
        profile,
        info: this.createReadyInfo('Resume profile saved locally.', true)
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to save resume profile.'
      };
    }
  }

  async clearProfile(): Promise<ResumeCommandResult> {
    try {
      await this.writeDatabase({
        schemaVersion: 1,
        profile: null
      });

      return {
        ok: true,
        info: this.createReadyInfo('Resume profile cleared.', false)
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to clear resume profile.'
      };
    }
  }

  private async readDatabase(): Promise<ResumeProfileDocument> {
    try {
      const content = await readFile(this.databasePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<ResumeProfileDocument>;

      if (parsed.schemaVersion !== 1) {
        return {
          schemaVersion: 1,
          profile: null
        };
      }

      return {
        schemaVersion: 1,
        profile: parsed.profile ? sanitizeProfile(parsed.profile) : null
      };
    } catch (error) {
      if (isFileMissingError(error)) {
        await this.writeDatabase({
          schemaVersion: 1,
          profile: null
        });

        return {
          schemaVersion: 1,
          profile: null
        };
      }

      throw error;
    }
  }

  private async writeDatabase(database: ResumeProfileDocument): Promise<void> {
    await mkdir(dirname(this.databasePath), {
      recursive: true
    });

    const tempPath = `${this.databasePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.databasePath);
  }

  private createReadyInfo(message: string, hasProfile: boolean): ResumeProfileInfo {
    return {
      status: 'ready',
      message,
      hasProfile,
      path: this.databasePath
    };
  }

  private createErrorInfo(error: unknown): ResumeProfileInfo {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Resume profile database is unavailable.',
      hasProfile: false,
      path: this.databasePath
    };
  }
}

function sanitizeProfile(profile: ResumeProfile): ResumeProfile {
  return {
    content: sanitizeProfileContent(profile.content),
    summary: sanitizeResumeProfileSummary(profile.summary, profile.content),
    createdAt: sanitizeText(profile.createdAt, 64),
    updatedAt: sanitizeText(profile.updatedAt, 64)
  };
}

function sanitizeProfileContent(value: string): string {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_PROFILE_LENGTH);
}

function sanitizeText(value: string, maxLength: number): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isFileMissingError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
