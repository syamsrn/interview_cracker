export interface KnowledgeSnippet {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDatabaseInfo {
  status: 'ready' | 'error';
  message: string;
  snippetCount: number;
  path?: string;
}

export interface KnowledgeListResult {
  ok: boolean;
  snippets: KnowledgeSnippet[];
  info: KnowledgeDatabaseInfo;
  error?: string;
}

export interface KnowledgeSearchResult {
  ok: boolean;
  snippets: KnowledgeSnippet[];
  info: KnowledgeDatabaseInfo;
  error?: string;
}

export interface KnowledgeCommandResult {
  ok: boolean;
  info: KnowledgeDatabaseInfo;
  snippet?: KnowledgeSnippet;
  error?: string;
}
