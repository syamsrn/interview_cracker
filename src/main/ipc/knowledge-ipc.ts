import { ipcMain } from 'electron';
import type { KnowledgeSnippet } from '../../shared/knowledge';
import { KnowledgeDatabase } from '../services/knowledge/knowledge-database';

export function registerKnowledgeIpcHandlers(knowledgeDatabase: KnowledgeDatabase): void {
  ipcMain.handle('knowledge:get-info', () => knowledgeDatabase.getInfo());
  ipcMain.handle('knowledge:list-snippets', () => knowledgeDatabase.listSnippets());
  ipcMain.handle('knowledge:clear-snippets', () => knowledgeDatabase.clearSnippets());

  ipcMain.handle('knowledge:search-snippets', (_event, query: unknown) => {
    return knowledgeDatabase.searchSnippets(typeof query === 'string' ? query : '');
  });

  ipcMain.handle('knowledge:save-snippet', (_event, payload: unknown) => {
    const snippet = parseKnowledgeSnippet(payload);

    if (!snippet) {
      return knowledgeDatabase.getInfo().then((info) => ({
        ok: false,
        info,
        error: 'Invalid personal knowledge snippet.'
      }));
    }

    return knowledgeDatabase.saveSnippet(snippet);
  });
}

function parseKnowledgeSnippet(value: unknown): Partial<KnowledgeSnippet> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.title !== 'string' || typeof record.content !== 'string') {
    return null;
  }

  return {
    id: typeof record.id === 'number' && Number.isFinite(record.id) ? record.id : undefined,
    title: record.title,
    content: record.content,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined
  };
}
