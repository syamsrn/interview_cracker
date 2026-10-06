import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  HistoryCommandResult,
  HistoryDatabaseInfo,
  HistoryListResult,
  StoredAnswerRecord
} from '../../../shared/history';

interface HistoryDatabaseDocument {
  schemaVersion: 1;
  records: StoredAnswerRecord[];
}

const MAX_RECORDS = 200;
const MAX_FIELD_LENGTH = 6000;

export class HistoryDatabase {
  constructor(private readonly databasePath: string) {}

  async getInfo(): Promise<HistoryDatabaseInfo> {
    try {
      const database = await this.readDatabase();

      return {
        status: 'ready',
        message: 'Local history database is ready.',
        recordCount: database.records.length,
        path: this.databasePath
      };
    } catch (error) {
      return this.createErrorInfo(error);
    }
  }

  async listAnswers(): Promise<HistoryListResult> {
    try {
      const database = await this.readDatabase();

      return {
        ok: true,
        records: database.records,
        info: {
          status: 'ready',
          message: 'Local history database is ready.',
          recordCount: database.records.length,
          path: this.databasePath
        }
      };
    } catch (error) {
      return {
        ok: false,
        records: [],
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to read local history database.'
      };
    }
  }

  async saveAnswer(record: StoredAnswerRecord): Promise<HistoryCommandResult> {
    try {
      const database = await this.readDatabase();
      const sanitizedRecord = sanitizeRecord(record);
      const records = [...database.records.filter((item) => item.id !== sanitizedRecord.id), sanitizedRecord].slice(
        -MAX_RECORDS
      );

      await this.writeDatabase({
        schemaVersion: 1,
        records
      });

      return {
        ok: true,
        info: {
          status: 'ready',
          message: 'Answer saved locally.',
          recordCount: records.length,
          path: this.databasePath
        }
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to save answer locally.'
      };
    }
  }

  async clearAnswers(): Promise<HistoryCommandResult> {
    try {
      await this.writeDatabase({
        schemaVersion: 1,
        records: []
      });

      return {
        ok: true,
        info: {
          status: 'ready',
          message: 'Local answer history cleared.',
          recordCount: 0,
          path: this.databasePath
        }
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to clear local answer history.'
      };
    }
  }

  private async readDatabase(): Promise<HistoryDatabaseDocument> {
    try {
      const content = await readFile(this.databasePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<HistoryDatabaseDocument>;

      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) {
        return {
          schemaVersion: 1,
          records: []
        };
      }

      return {
        schemaVersion: 1,
        records: parsed.records.map(sanitizeRecord).slice(-MAX_RECORDS)
      };
    } catch (error) {
      if (isFileMissingError(error)) {
        await this.writeDatabase({
          schemaVersion: 1,
          records: []
        });

        return {
          schemaVersion: 1,
          records: []
        };
      }

      throw error;
    }
  }

  private async writeDatabase(database: HistoryDatabaseDocument): Promise<void> {
    await mkdir(dirname(this.databasePath), {
      recursive: true
    });

    const tempPath = `${this.databasePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.databasePath);
  }

  private createErrorInfo(error: unknown): HistoryDatabaseInfo {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Local history database is unavailable.',
      recordCount: 0,
      path: this.databasePath
    };
  }
}

function sanitizeRecord(record: StoredAnswerRecord): StoredAnswerRecord {
  return {
    id: typeof record.id === 'number' && Number.isFinite(record.id) ? record.id : Date.now(),
    question: sanitizeText(record.question),
    answer: sanitizeText(record.answer),
    category: record.category,
    detail: record.detail,
    createdAt: sanitizeText(record.createdAt),
    followUpQuestions: Array.isArray(record.followUpQuestions)
      ? record.followUpQuestions.map(sanitizeText).filter(Boolean).slice(0, 3)
      : undefined
  };
}

function sanitizeText(value: string): string {
  return String(value ?? '').trim().slice(0, MAX_FIELD_LENGTH);
}

function isFileMissingError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
