import type { ResumeProfileSummary } from '../../../shared/resume';

const EMPTY_SUMMARY: ResumeProfileSummary = {
  name: '',
  targetRole: '',
  skills: '',
  projects: '',
  experience: ''
};

const SECTION_PATTERNS: Record<keyof Omit<ResumeProfileSummary, 'name' | 'targetRole'>, RegExp> = {
  skills: /^(technical\s+skills?|skills?|tools?|technologies)\b/i,
  projects: /^(projects?|selected\s+projects?)\b/i,
  experience: /^(experience|work\s+experience|professional\s+experience|employment)\b/i
};

const SECTION_BOUNDARY = /^(education|certifications?|achievements?|awards?|languages?|interests?|summary|objective|skills?|technical\s+skills?|tools?|technologies|projects?|experience|work\s+experience|professional\s+experience|employment)\b/i;

export function extractResumeProfileSummary(content: string): ResumeProfileSummary {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    name: findName(lines),
    targetRole: inferTargetRole(lines, content),
    skills: extractSection(lines, SECTION_PATTERNS.skills),
    projects: extractSection(lines, SECTION_PATTERNS.projects),
    experience: extractSection(lines, SECTION_PATTERNS.experience)
  };
}

export function sanitizeResumeProfileSummary(value: Partial<ResumeProfileSummary> | undefined, content: string): ResumeProfileSummary {
  const extracted = extractResumeProfileSummary(content);

  if (!value) {
    return extracted;
  }

  return {
    name: sanitize(value.name, 120),
    targetRole: sanitize(value.targetRole, 180),
    skills: sanitize(value.skills, 900),
    projects: sanitize(value.projects, 1200),
    experience: sanitize(value.experience, 1200)
  };
}

export function emptyResumeProfileSummary(): ResumeProfileSummary {
  return { ...EMPTY_SUMMARY };
}

function findName(lines: string[]): string {
  return lines.find((line) =>
    line.length >= 3 &&
    line.length <= 80 &&
    !/@|https?:|\d{5,}|\b(phone|email|linkedin|github|resume|curriculum vitae)\b/i.test(line) &&
    /^[A-Za-z][A-Za-z .'-]+$/.test(line)
  ) ?? '';
}

function inferTargetRole(lines: string[], content: string): string {
  const objective = lines.find((line) => /\b(seeking|target|objective|aspiring)\b/i.test(line));

  if (objective) {
    return sanitize(objective, 180);
  }

  const normalized = content.toLowerCase();

  if (/generative ai|llm|rag|machine learning/.test(normalized)) {
    return 'Generative AI Engineer';
  }

  if (/data scientist|data analysis|analytics/.test(normalized)) {
    return 'Data Scientist';
  }

  if (/software engineer|software developer|full.stack/.test(normalized)) {
    return 'Software Engineer';
  }

  return '';
}

function extractSection(lines: string[], heading: RegExp): string {
  const start = lines.findIndex((line) => heading.test(line));

  if (start < 0) {
    return '';
  }

  const collected: string[] = [];

  for (const line of lines.slice(start + 1)) {
    if (SECTION_BOUNDARY.test(line)) {
      break;
    }

    collected.push(line.replace(/^[•·▪\-*]\s*/, ''));

    if (collected.join(' ').length >= 900 || collected.length >= 8) {
      break;
    }
  }

  return sanitize(collected.join(' | '), 900);
}

function sanitize(value: unknown, maxLength: number): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}
