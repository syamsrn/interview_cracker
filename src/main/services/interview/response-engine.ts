import type {
  AIAnswerDetail,
  AIResponseStyle,
  ConversationMemoryItem,
  GenerateAnswerRequest,
  InterviewQuestionCategory
} from '../../../shared/ai';
import type { KnowledgeSnippet } from '../../../shared/knowledge';
import type { ResumeProfile } from '../../../shared/resume';

interface CategoryRule {
  category: InterviewQuestionCategory;
  signals: readonly string[];
}

export interface InterviewPromptResult {
  category: InterviewQuestionCategory;
  prompt: string;
}

interface FollowUpPredictionRequest {
  question: string;
  answer: string;
  category: InterviewQuestionCategory;
  request: GenerateAnswerRequest;
}

const categoryRules: readonly CategoryRule[] = [
  {
    category: 'RAG',
    signals: ['rag', 'retrieval augmented', 'retrieval-augmented', 'vector database', 'embedding search', 'retrieval']
  },
  {
    category: 'Agents / Agentic AI',
    signals: ['agent', 'agentic', 'tool calling', 'function calling', 'multi-agent', 'planner', 'autonomous']
  },
  {
    category: 'LLMs',
    signals: ['llm', 'large language model', 'prompt', 'context window', 'token', 'fine-tune', 'fine tune']
  },
  {
    category: 'Generative AI',
    signals: ['generative ai', 'genai', 'diffusion', 'prompt engineering', 'text generation']
  },
  {
    category: 'Deep Learning',
    signals: ['neural network', 'backpropagation', 'cnn', 'rnn', 'transformer', 'pytorch', 'tensorflow', 'deep learning']
  },
  {
    category: 'NLP',
    signals: ['nlp', 'named entity', 'sentiment', 'tokenization', 'lemmatization', 'language model']
  },
  {
    category: 'Machine Learning',
    signals: ['machine learning', 'classification', 'regression', 'overfitting', 'underfitting', 'feature engineering', 'model evaluation']
  },
  {
    category: 'SQL',
    signals: ['sql', 'join', 'group by', 'window function', 'query', 'database index', 'normalization']
  },
  {
    category: 'Python',
    signals: ['python', 'decorator', 'generator', 'list comprehension', 'gil', 'asyncio', 'pandas']
  },
  {
    category: 'System Design',
    signals: ['system design', 'scale', 'scalable', 'load balancer', 'cache', 'distributed', 'microservice', 'rate limit']
  },
  {
    category: 'DSA / Coding',
    signals: ['code', 'algorithm', 'complexity', 'leetcode', 'array', 'string', 'tree', 'graph', 'dynamic programming', 'linked list']
  },
  {
    category: 'Project Questions',
    signals: ['project', 'built', 'implemented', 'architecture of your', 'challenge in your project', 'current project']
  },
  {
    category: 'Resume Questions',
    signals: ['resume', 'tell me about yourself', 'experience', 'your background', 'your profile', 'walk me through']
  },
  {
    category: 'Behavioral / HR',
    signals: ['conflict', 'failure', 'strength', 'weakness', 'leadership', 'team', 'deadline', 'pressure', 'why should we hire']
  }
];

export class InterviewResponseEngine {
  classifyQuestion(question: string): InterviewQuestionCategory {
    const normalizedQuestion = question.toLowerCase();
    const matchingRule = categoryRules.find((rule) =>
      rule.signals.some((signal) => matchesSignal(normalizedQuestion, signal))
    );

    return matchingRule?.category ?? 'General Technical';
  }

  buildPrompt(request: GenerateAnswerRequest): InterviewPromptResult {
    const question = request.question.trim();
    const category = this.classifyQuestion(question);
    const detail = request.maxAnswerLength ?? request.detail;
    const style = request.responseStyle ?? 'concise';

    return {
      category,
      prompt: [
        ...buildSystemInstructions(detail, style),
        '',
        `Detected category: ${category}`,
        getCategoryContext(category),
        '',
        ...buildConversationMemoryInstructions(request.conversationMemory),
        ...buildResumeProfileInstructions(request.resumeProfile),
        ...buildPersonalKnowledgeInstructions(request.personalKnowledge),
        '',
        ...buildFormatInstructions(
          category,
          Boolean(request.resumeProfile?.content || request.personalKnowledge?.length)
        ),
        '',
        'Question:',
        question
      ].join('\n')
    };
  }

  predictFollowUpQuestions(predictionRequest: FollowUpPredictionRequest): string[] {
    const question = predictionRequest.question.trim();
    const answer = predictionRequest.answer.trim();
    const candidates = [
      ...getAnswerFollowUps(answer),
      ...getCategoryFollowUps(predictionRequest.category),
      ...getContextFollowUps(predictionRequest.request),
      ...getFallbackFollowUps()
    ];
    const normalizedQuestion = normalizeQuestion(question);
    const uniqueQuestions: string[] = [];

    for (const candidate of candidates) {
      const followUpQuestion = normalizeFollowUp(candidate);

      if (!followUpQuestion || normalizeQuestion(followUpQuestion) === normalizedQuestion) {
        continue;
      }

      if (uniqueQuestions.some((existingQuestion) => normalizeQuestion(existingQuestion) === normalizeQuestion(followUpQuestion))) {
        continue;
      }

      uniqueQuestions.push(followUpQuestion);

      if (uniqueQuestions.length === 5) {
        break;
      }
    }

    return uniqueQuestions;
  }
}

function buildSystemInstructions(detail: AIAnswerDetail, style: AIResponseStyle): string[] {
  return [
    'You are Interview Coach. Create the exact answer text the candidate can speak in an interview.',
    'Voice: first person, practical, clear, and natural. The result must sound like the candidate speaking, not a generated case study.',
    'Use "I", "my", and "in my experience" only for facts explicitly supported by the supplied resume/profile or personal knowledge.',
    'Do not write classroom-style general answers using "we need to", "one should", or "the candidate".',
    'Sound implementation-focused: debugging, evaluation, retrieval quality, latency, prompts, data quality, and deployment tradeoffs.',
    'Resolve ambiguous technical acronyms using the detected interview category.',
    'Treat the supplied resume/profile and personal knowledge as the only source of personal facts. Use a specific project, employer, tool, title, metric, or achievement only when it appears in that context.',
    'Never infer a current role, company, project, production deployment, metric, or ownership from a generic skill list. Never turn a possible skill into a completed achievement.',
    'When the saved context does not prove a personal example, say "I would approach it..." and omit the RESUME EXAMPLE section rather than inventing one.',
    'Make the explanation concrete: describe the candidate decision, action, and tradeoff, instead of broad claims such as "I delivered a reliable system".',
    'Return only the candidate answer text. Use the requested uppercase section headings exactly; do not wrap them in markdown symbols and do not use bold markdown.',
    'Do not include interviewer follow-up text, fabricated facts, or meta-commentary.',
    '',
    `Response style: ${style}.`,
    `Answer length: ${detail}.`,
    getLengthInstruction(detail)
  ];
}

function buildResumeProfileInstructions(profile: ResumeProfile | undefined): string[] {
  if (!profile?.content) {
    return [];
  }

  return [
    '',
    'Resume profile:',
    'Use this locally saved resume/profile context as the candidate context whenever it can make the answer personal and grounded.',
    'Do not add employers, dates, metrics, tools, responsibilities, or achievements that are not present in this profile.',
    ...formatResumeSummary(profile),
    `Profile content: ${summarizeResumeProfile(profile.content)}`
  ];
}

function formatResumeSummary(profile: ResumeProfile): string[] {
  const entries = [
    ['Name', profile.summary?.name],
    ['Target role', profile.summary?.targetRole],
    ['Skills', profile.summary?.skills],
    ['Projects', profile.summary?.projects],
    ['Experience', profile.summary?.experience]
  ].filter(([, value]) => Boolean(value?.trim()));

  if (!entries.length) {
    return [];
  }

  return [
    'Candidate profile summary (editable and preferred over inferred details):',
    ...entries.map(([label, value]) => `${label}: ${value}`)
  ];
}

function summarizeResumeProfile(content: string): string {
  const normalizedContent = content.trim().replace(/\s+/g, ' ');

  if (normalizedContent.length <= 900) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 900)}...`;
}

function buildPersonalKnowledgeInstructions(knowledge: KnowledgeSnippet[] | undefined): string[] {
  if (!knowledge?.length) {
    return [];
  }

  return [
    '',
    'Personal knowledge:',
    'Use these locally saved snippets as candidate context whenever they can make the answer personal and grounded.',
    'If a snippet gives project, resume, stack, or preference details, use it carefully and do not add facts beyond it.',
    ...knowledge.flatMap((snippet, index) => [
      '',
      `Snippet ${index + 1} title: ${snippet.title}`,
      `Snippet ${index + 1} content: ${summarizeKnowledgeContent(snippet.content)}`
    ])
  ];
}

function getCategoryFollowUps(category: InterviewQuestionCategory): string[] {
  switch (category) {
    case 'RAG':
      return [
        'How would you improve retrieval quality in that RAG system?',
        'How would you evaluate whether the retrieved context is actually useful?',
        'What latency and cost tradeoffs would you consider in production?'
      ];
    case 'LLMs':
      return [
        'How would you handle hallucinations in this solution?',
        'How would you choose between prompting, RAG, and fine-tuning?',
        'What metrics would you track before shipping this to users?'
      ];
    case 'Agents / Agentic AI':
      return [
        'How would you design tool-calling safety for this agent?',
        'How would you debug a failed multi-step agent run?',
        'When would you avoid using an agentic workflow?'
      ];
    case 'System Design':
      return [
        'How would you scale this design for higher traffic?',
        'Where would you add caching, retries, and observability?',
        'What failure modes would you test first?'
      ];
    case 'DSA / Coding':
      return [
        'Can you walk through the time and space complexity?',
        'What edge cases would you test?',
        'Can you optimize this approach further?'
      ];
    case 'Project Questions':
      return [
        'What was the hardest technical challenge in that project?',
        'How did you measure whether the project worked well?',
        'What would you improve if you rebuilt it today?'
      ];
    case 'Resume Questions':
      return [
        'Which project best shows your GenAI engineering experience?',
        'What technical challenge from your experience are you most comfortable discussing deeply?',
        'How does your recent work map to this role?'
      ];
    case 'Behavioral / HR':
      return [
        'What did you learn from that situation?',
        'What would you do differently next time?',
        'How did you communicate the tradeoffs to your team?'
      ];
    case 'Machine Learning':
      return [
        'How would you evaluate model performance and drift?',
        'How would you avoid overfitting in this case?',
        'What features or data quality checks would matter most?'
      ];
    case 'Python':
      return [
        'What edge cases would you handle in Python?',
        'How would you make this implementation easier to test?',
        'What performance bottlenecks would you watch for?'
      ];
    case 'SQL':
      return [
        'How would you optimize this query?',
        'What indexes would help and what tradeoffs would they introduce?',
        'How would you validate the result against edge cases?'
      ];
    default:
      return [
        'Can you explain one real example where you applied this?',
        'What tradeoffs would you consider in production?',
        'How would you validate that your approach is working?'
      ];
  }
}

function getContextFollowUps(request: GenerateAnswerRequest): string[] {
  const followUps: string[] = [];

  if (request.resumeProfile?.content) {
    followUps.push(
      'Can you connect this answer to one project from your resume?',
      'What part of your resume best supports this answer?'
    );
  }

  if (request.personalKnowledge?.length) {
    followUps.push(
      'Can you explain the saved project context in more technical depth?',
      'What tradeoff from your saved project context would you highlight?'
    );
  }

  if (request.conversationMemory?.length) {
    followUps.push('How does this connect to your previous answer?');
  }

  return followUps;
}

function getAnswerFollowUps(answer: string): string[] {
  const normalizedAnswer = answer.toLowerCase();
  const followUps: string[] = [];

  if (normalizedAnswer.includes('latency')) {
    followUps.push('How would you reduce latency without hurting answer quality?');
  }

  if (normalizedAnswer.includes('evaluation') || normalizedAnswer.includes('metric')) {
    followUps.push('Which evaluation metrics would you trust most and why?');
  }

  if (normalizedAnswer.includes('vector') || normalizedAnswer.includes('embedding')) {
    followUps.push('How would you choose the embedding model and vector database?');
  }

  if (normalizedAnswer.includes('hybrid retrieval') || normalizedAnswer.includes('bm25') || normalizedAnswer.includes('rerank')) {
    followUps.push('Why did you use hybrid retrieval or reranking instead of vector search alone?');
  }

  if (normalizedAnswer.includes('fastapi') || normalizedAnswer.includes('api') || normalizedAnswer.includes('backend')) {
    followUps.push('How did you make the backend reliable when an upstream model or retrieval call failed?');
  }

  if (normalizedAnswer.includes('hallucination') || normalizedAnswer.includes('grounding') || normalizedAnswer.includes('faithfulness')) {
    followUps.push('How did you verify that the answer stayed grounded in the retrieved context?');
  }

  if (normalizedAnswer.includes('agent') || normalizedAnswer.includes('tool calling')) {
    followUps.push('How would you prevent unsafe or incorrect tool calls in that workflow?');
  }

  return followUps;
}

function getFallbackFollowUps(): string[] {
  return [
    'What was the most difficult implementation decision and how did you make it?',
    'Which tradeoff would you explain first to an interviewer?',
    'How would you measure whether this approach is successful?',
    'What would you improve if you had more time?',
    'What failure mode would you test before using this in production?'
  ];
}

function normalizeFollowUp(value: string): string {
  const question = value.trim().replace(/\s+/g, ' ');

  if (!question) {
    return '';
  }

  return question.endsWith('?') ? question : `${question}?`;
}

function normalizeQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function summarizeKnowledgeContent(content: string): string {
  const normalizedContent = content.trim().replace(/\s+/g, ' ');

  if (normalizedContent.length <= 900) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 900)}...`;
}

function buildConversationMemoryInstructions(memory: ConversationMemoryItem[] | undefined): string[] {
  if (!memory?.length) {
    return [];
  }

  return [
    '',
    'Session memory:',
    'Use these recent in-memory practice turns only when the current question refers to previous context.',
    'Do not claim this memory is a saved profile, resume, database, or long-term history.',
    ...memory.flatMap((item, index) => [
      '',
      `Turn ${index + 1} category: ${item.category}`,
      `Turn ${index + 1} question: ${item.question}`,
      `Turn ${index + 1} answer summary: ${summarizeMemoryAnswer(item.answer)}`
    ])
  ];
}

function summarizeMemoryAnswer(answer: string): string {
  const normalizedAnswer = answer.trim().replace(/\s+/g, ' ');

  if (normalizedAnswer.length <= 450) {
    return normalizedAnswer;
  }

  return `${normalizedAnswer.slice(0, 450)}...`;
}

function getCategoryContext(category: InterviewQuestionCategory): string {
  if (category === 'RAG') {
    return 'Category context: RAG means Retrieval-Augmented Generation in this interview app; do not answer as fabric, a cloth, or the common word "rag".';
  }

  if (category === 'LLMs') {
    return 'Category context: LLM means Large Language Model.';
  }

  if (category === 'NLP') {
    return 'Category context: NLP means Natural Language Processing.';
  }

  if (category === 'DSA / Coding') {
    return 'Category context: DSA means Data Structures and Algorithms.';
  }

  return 'Category context: answer in the context of a technical interview.';
}

function matchesSignal(normalizedQuestion: string, signal: string): boolean {
  if (/^[a-z0-9]+$/.test(signal) && signal.length <= 4) {
    return new RegExp(`\\b${escapeRegExp(signal)}\\b`).test(normalizedQuestion);
  }

  return normalizedQuestion.includes(signal);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLengthInstruction(detail: AIAnswerDetail): string {
  if (detail === 'short') {
    return 'Target about 25-35 seconds spoken, roughly 70-95 words.';
  }

  if (detail === 'expanded') {
    return 'Target about 90 seconds spoken, roughly 220-280 words, while staying natural and structured.';
  }

  return 'Target about 55-70 seconds spoken, roughly 140-190 words.';
}

function buildFormatInstructions(category: InterviewQuestionCategory, hasCandidateContext: boolean): string[] {
  if (category === 'DSA / Coding') {
    return [
      'Use exactly this format:',
      'DIRECT ANSWER',
      'State the core idea in one or two sentences.',
      '',
      'APPROACH',
      'Explain the simplest reliable approach.',
      '',
      'CODE',
      'Provide concise TypeScript or Python-style pseudocode unless the question asks for a language.',
      '',
      'COMPLEXITY',
      'Time: O(...)',
      'Space: O(...)',
      '',
      'EXPLANATION',
      'Explain edge cases and why the approach works.',
      '',
      'CLOSING',
      'End with one concise confidence-building line.'
    ];
  }

  return [
    'Use exactly this readable interview-answer format:',
    'DIRECT ANSWER',
    'Give a direct first-person response in one short paragraph.',
    '',
    'KEY POINTS',
    'Give 2-4 concise bullet points covering the approach, implementation choices, and an important tradeoff.',
    ...(hasCandidateContext
      ? [
          '',
          'RESUME EXAMPLE',
          'Connect the answer to one relevant fact from the supplied resume/profile or personal knowledge. Do not add facts that are not supplied.'
        ]
      : []),
    '',
    'CLOSING',
    'End with one concise sentence that reinforces the practical outcome or tradeoff.',
    ...(category === 'Behavioral / HR'
      ? ['For behavioral questions, keep the direct answer grounded in a concise STAR-style situation and action.']
      : []),
    ...(category === 'Project Questions' || category === 'Resume Questions'
      ? ['For project or resume questions, prioritize the candidate context and explain the personal contribution without inventing details.']
      : [])
  ];
}
