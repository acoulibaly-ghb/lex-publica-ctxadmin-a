export enum ChatMode {
  TEXT = 'TEXT',
  VOICE = 'VOICE'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isQuiz?: boolean;           // ← AJOUTÉ pour identifier les messages quiz
  quizData?: QuizQuestion[];  // ← AJOUTÉ pour stocker les questions
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

// ⬇️ NOUVEAU : Interface pour les questions de quiz
export interface QuizQuestion {
  type: 'mcq' | 'truefalse' | 'case'; // Type de question
  question: string;
  
  // Pour QCM et Vrai/Faux
  options?: string[];
  correctAnswerIndex?: number;
  
  // Pour cas pratique
  correctAnswer?: string; // Réponse attendue (pour évaluation IA)
  
  explanation: string;
}
