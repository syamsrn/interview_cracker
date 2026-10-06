import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  KnowledgeCommandResult,
  KnowledgeDatabaseInfo,
  KnowledgeListResult,
  KnowledgeSearchResult,
  KnowledgeSnippet
} from '../../../shared/knowledge';

interface KnowledgeDatabaseDocument {
  schemaVersion: 1;
  snippets: KnowledgeSnippet[];
}

const MAX_SNIPPETS = 100;
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_SEARCH_RESULTS = 4;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'for',
  'how',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'with',
  'you'
]);

export class KnowledgeDatabase {
  constructor(private readonly databasePath: string) {}

  async getInfo(): Promise<KnowledgeDatabaseInfo> {
    try {
      const database = await this.readDatabase();

      return this.createReadyInfo('Personal knowledge database is ready.', database.snippets.length);
    } catch (error) {
      return this.createErrorInfo(error);
    }
  }

  async listSnippets(): Promise<KnowledgeListResult> {
    try {
      const database = await this.readDatabase();

      return {
        ok: true,
        snippets: database.snippets,
        info: this.createReadyInfo('Personal knowledge database is ready.', database.snippets.length)
      };
    } catch (error) {
      return {
        ok: false,
        snippets: [],
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to read personal knowledge database.'
      };
    }
  }

  async searchSnippets(query: string): Promise<KnowledgeSearchResult> {
    try {
      const database = await this.readDatabase();
      const queryTerms = tokenize(query);

      if (!queryTerms.length) {
        return {
          ok: true,
          snippets: [],
          info: this.createReadyInfo('No knowledge snippets matched this request.', database.snippets.length)
        };
      }

      const snippets = database.snippets
        .map((snippet) => ({
          snippet,
          score: scoreSnippet(snippet, queryTerms)
        }))
        .filter((item) => item.score > 0)
        .sort((first, second) => second.score - first.score)
        .slice(0, MAX_SEARCH_RESULTS)
        .map((item) => item.snippet);

      return {
        ok: true,
        snippets,
        info: this.createReadyInfo(
          snippets.length ? `${snippets.length} personal knowledge snippet(s) retrieved.` : 'No knowledge snippets matched this request.',
          database.snippets.length
        )
      };
    } catch (error) {
      return {
        ok: false,
        snippets: [],
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to search personal knowledge database.'
      };
    }
  }

  async saveSnippet(snippet: Partial<KnowledgeSnippet>): Promise<KnowledgeCommandResult> {
    try {
      const database = await this.readDatabase();
      const now = new Date().toISOString();
      const sanitizedSnippet = sanitizeSnippet({
        id: typeof snippet.id === 'number' && Number.isFinite(snippet.id) ? snippet.id : Date.now(),
        title: snippet.title ?? '',
        content: snippet.content ?? '',
        createdAt: snippet.createdAt ?? now,
        updatedAt: now
      });

      if (!sanitizedSnippet.title || !sanitizedSnippet.content) {
        const info = this.createReadyInfo('Knowledge title and note are required.', database.snippets.length);
        return {
          ok: false,
          info,
          error: info.message
        };
      }

      const snippets = [
        ...database.snippets.filter((item) => item.id !== sanitizedSnippet.id),
        sanitizedSnippet
      ].slice(-MAX_SNIPPETS);

      await this.writeDatabase({
        schemaVersion: 1,
        snippets
      });

      return {
        ok: true,
        snippet: sanitizedSnippet,
        info: this.createReadyInfo('Personal knowledge saved locally.', snippets.length)
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to save personal knowledge.'
      };
    }
  }

  async clearSnippets(): Promise<KnowledgeCommandResult> {
    try {
      await this.writeDatabase({
        schemaVersion: 1,
        snippets: []
      });

      return {
        ok: true,
        info: this.createReadyInfo('Personal knowledge cleared.', 0)
      };
    } catch (error) {
      return {
        ok: false,
        info: this.createErrorInfo(error),
        error: error instanceof Error ? error.message : 'Unable to clear personal knowledge.'
      };
    }
  }

  private async readDatabase(): Promise<KnowledgeDatabaseDocument> {
    try {
      const content = await readFile(this.databasePath, 'utf8');
      const parsed = JSON.parse(content) as Partial<KnowledgeDatabaseDocument>;

      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.snippets)) {
        return {
          schemaVersion: 1,
          snippets: []
        };
      }

      return {
        schemaVersion: 1,
        snippets: parsed.snippets.map(sanitizeSnippet).slice(-MAX_SNIPPETS)
      };
    } catch (error) {
      if (isFileMissingError(error)) {
        await this.writeDatabase({
          schemaVersion: 1,
          snippets: []
        });

        return {
          schemaVersion: 1,
          snippets: []
        };
      }

      throw error;
    }
  }

  private async writeDatabase(database: KnowledgeDatabaseDocument): Promise<void> {
    await mkdir(dirname(this.databasePath), {
      recursive: true
    });

    const tempPath = `${this.databasePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8');
    await rename(tempPath, this.databasePath);
  }

  private createReadyInfo(message: string, snippetCount: number): KnowledgeDatabaseInfo {
    return {
      status: 'ready',
      message,
      snippetCount,
      path: this.databasePath
    };
  }

  private createErrorInfo(error: unknown): KnowledgeDatabaseInfo {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Personal knowledge database is unavailable.',
      snippetCount: 0,
      path: this.databasePath
    };
  }
}

function sanitizeSnippet(snippet: KnowledgeSnippet): KnowledgeSnippet {
  return {
    id: typeof snippet.id === 'number' && Number.isFinite(snippet.id) ? snippet.id : Date.now(),
    title: sanitizeText(snippet.title, MAX_TITLE_LENGTH),
    content: sanitizeText(snippet.content, MAX_CONTENT_LENGTH),
    createdAt: sanitizeText(snippet.createdAt, 64),
    updatedAt: sanitizeText(snippet.updatedAt, 64)
  };
}

function sanitizeText(value: string, maxLength: number): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
    )
  );
}

function scoreSnippet(snippet: KnowledgeSnippet, queryTerms: string[]): number {
  const title = snippet.title.toLowerCase();
  const content = snippet.content.toLowerCase();

  return queryTerms.reduce((score, term) => {
    const titleScore = title.includes(term) ? 4 : 0;
    const contentScore = content.includes(term) ? 1 : 0;
    return score + titleScore + contentScore;
  }, 0);
}

function isFileMissingError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
