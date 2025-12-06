export enum ChatMode {
  TEXT = 'TEXT',
  VOICE = 'VOICE'
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isQuiz?: boolean;
  quizData?: QuizQuestion[];
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    transcripts?: {role: 'user' | 'model', text: string}[];
    lastModified: number;
    mode: ChatMode;
}

export interface AudioVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  volume: number;
}

// Glossary item supprimé car non utilisé dans la version "Essentielle"
export interface GlossaryItem {
  term: string;
  definition: string;
  category?: string;
}
