export type QuestionDetectionConfidence = 'high' | 'medium' | 'low';

export interface QuestionDetectionResult {
  isQuestion: boolean;
  confidence: QuestionDetectionConfidence;
  reason: string;
}

const questionStarts = [
  'what',
  'why',
  'how',
  'when',
  'where',
  'who',
  'which',
  'can',
  'could',
  'would',
  'should',
  'do',
  'does',
  'did',
  'is',
  'are',
  'was',
  'were',
  'explain',
  'describe',
  'define',
  'compare'
];

const interviewPhrases = [
  'tell me about',
  'tell me what',
  'walk me through',
  'difference between',
  'how would you',
  'can you tell me',
  'could you explain',
  'what is',
  'what are',
  'why should we hire'
];

const nonQuestionFragments = ['thank you', 'thanks', 'okay', 'ok', 'yes', 'no'];

export function detectInterviewQuestion(input: string): QuestionDetectionResult {
  const text = input.trim();
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
  const words = normalizedText.split(' ').filter(Boolean);

  if (!normalizedText || words.length < 2) {
    return {
      isQuestion: false,
      confidence: 'low',
      reason: 'Transcript is too short to classify as a question.'
    };
  }

  if (nonQuestionFragments.includes(normalizedText)) {
    return {
      isQuestion: false,
      confidence: 'low',
      reason: 'Transcript looks like a short acknowledgement.'
    };
  }

  if (text.endsWith('?')) {
    return {
      isQuestion: true,
      confidence: 'high',
      reason: 'Transcript ends with a question mark.'
    };
  }

  if (interviewPhrases.some((phrase) => normalizedText.includes(phrase))) {
    return {
      isQuestion: true,
      confidence: 'high',
      reason: 'Transcript contains an interview question phrase.'
    };
  }

  if (questionStarts.includes(words[0])) {
    return {
      isQuestion: true,
      confidence: words.length >= 4 ? 'high' : 'medium',
      reason: 'Transcript starts with a question word.'
    };
  }

  return {
    isQuestion: false,
    confidence: 'low',
    reason: 'Transcript does not contain a clear question cue.'
  };
}
