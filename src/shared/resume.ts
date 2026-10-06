export interface ResumeProfileSummary {
  name: string;
  targetRole: string;
  skills: string;
  projects: string;
  experience: string;
}

export interface ResumeProfile {
  content: string;
  summary: ResumeProfileSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeProfileInfo {
  status: 'ready' | 'error';
  message: string;
  hasProfile: boolean;
  path?: string;
}

export interface ResumeProfileResult {
  ok: boolean;
  profile?: ResumeProfile;
  info: ResumeProfileInfo;
  error?: string;
}

export interface ResumeCommandResult {
  ok: boolean;
  profile?: ResumeProfile;
  info: ResumeProfileInfo;
  error?: string;
  cancelled?: boolean;
}
