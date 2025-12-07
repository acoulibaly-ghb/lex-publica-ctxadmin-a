import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Message, ChatSession, ChatMode, QuizQuestion } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';
import { fileToBase64 } from '../utils/file-utils';

// --- Markdown Component Helper ---
const parseBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const SimpleMarkdown = ({ text, isUser }: { text: string, isUser: boolean }) => {
  if (!text) return null;
  
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key} className="list-disc pl-6 mb-4 space-y-2 marker:text-indigo-400 text-slate-700">
          {[...currentList]}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    
    if (line.startsWith('### ')) {
      flushList(`list-before-${index}`);
      elements.push(
        <h3 key={`h3-${index}`} className={`text-lg font-bold mt-6 mb-3 ${isUser ? 'text-white' : 'text-indigo-800 border-b border-indigo-100 pb-1'}`}>
          {parseBold(line.replace('### ', ''))}
        </h3>
      );
    } 
    else if (line.startsWith('## ')) {
        flushList(`list-before-${index}`);
        elements.push(
          <h2 key={`h2-${index}`} className={`text-xl font-extrabold mt-8 mb-4 ${isUser ? 'text-white' : 'text-indigo-900'}`}>
            {parseBold(line.replace('## ', ''))}
          </h2>
        );
      }
    else if (line.startsWith('#### ') || line.startsWith('##### ')) {
        flushList(`list-before-${index}`);
        elements.push(
          <p key={`h-bold-${index}`} className={`font-bold mt-4 mb-2 text-base ${isUser ? 'text-white' : 'text-indigo-700'}`}>
            {parseBold(line.replace(/#{4,5} /, ''))}
          </p>
        );
    }
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(
        <li key={`item-${index}`} className="pl-1 leading-relaxed">
          {parseBold(line.replace(/^[-*] /, ''))}
        </li>
      );
    } 
    else {
      if (trimmedLine !== '') {
        flushList(`list-before-${index}`);
        elements.push(
          <p key={`p-${index}`} className="mb-4 last:mb-0 leading-relaxed text-slate-700">
            {parseBold(line)}
          </p>
        );
      } else {
          flushList(`list-before-${index}`);
      }
    }
  });

  flushList('list-end');

  return <div className={`text-[15px] ${isUser ? 'leading-relaxed text-white' : 'leading-8 text-slate-800'}`}>{elements}</div>;
};

// --- COMPONENTS ---

// Quiz Component (kept for potential JSON-based quizzes)
const QuizDisplay = ({ data }: { data: QuizQuestion[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [userAnswer, setUserAnswer] = useState<string>('');
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [showScore, setShowScore] = useState(false);
    const [aiEvaluation, setAiEvaluation] = useState<string>('');

    const question = data[currentIndex];

    const handleOptionClick = (idx: number) => {
        if (isAnswered || question.type === 'case') return;
        setSelectedOption(idx);
        setIsAnswered(true);
        if (idx === question.correctAnswerIndex) setScore(s => s + 1);
    };

    const handleCaseSubmit = async () => {
        if (!userAnswer.trim() || isAnswered) return;
        setIsAnswered(true);
        
        const prompt = `Tu es un correcteur en droit du contentieux international.
Question posée : "${question.question}"
Réponse de l'étudiant : "${userAnswer}"
Éléments de réponse attendus : "${question.correctAnswer}"

Évalue cette réponse sur 2 points et donne un feedback constructif (2-3 phrases max).
Format : "Note : X/2. [Feedback]"`;

        try {
            const API_KEY = import.meta.env.VITE_API_KEY;
            if (!API_KEY) throw new Error("API Key missing");
            
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            
            const evaluation = result.response?.text() || "Évaluation en cours...";
            setAiEvaluation(evaluation);
            
            if (evaluation.includes("2/2") || evaluation.includes("Excellent")) {
                setScore(s => s + 1);
            } else if (evaluation.includes("1.5/2") || evaluation.includes("1/2")) {
                setScore(s => s + 0.5);
            }
        } catch (error) {
            console.error(error);
            setAiEvaluation("Erreur lors de l'évaluation. Votre réponse a été enregistrée.");
        }
    };

    const nextQuestion = () => {
        if (currentIndex < data.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
            setUserAnswer('');
            setAiEvaluation('');
            setIsAnswered(false);
        } else {
            setShowScore(true);
        }
    };

    if (showScore) {
        const percentage = Math.round((score / data.length) * 100);
        return (
            <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-3xl border border-indigo-100 text-center shadow-sm">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    {percentage}%
                </div>
                <h3 className="text-2xl font-bold text-indigo-900 mb-2">Quiz Terminé !</h3>
                <p className="text-lg mb-6 text-slate-600">
                    Votre score : <span className="font-bold text-indigo-600">{score.toFixed(1)} / {data.length}</span>
                </p>
                
                <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                </div>
                
                <p className="text-sm font-medium text-slate-500 bg-slate-50 py-2 px-4 rounded-lg inline-block">
                    {percentage >= 80 ? "🎉 Excellent ! Maîtrise parfaite." : percentage >= 60 ? "👍 Bon travail !" : "📚 Continuez à réviser le cours."}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mt-4 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">
                    Question {currentIndex + 1}/{data.length}
                </span>
                <span className="text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider" style={{
                    backgroundColor: question.type === 'mcq' ? '#e0f2fe' : question.type === 'truefalse' ? '#fef3c7' : '#f0fdf4',
                    color: question.type === 'mcq' ? '#0369a1' : question.type === 'truefalse' ? '#92400e' : '#166534'
                }}>
                    {question.type === 'mcq' ? '📝 QCM' : question.type === 'truefalse' ? '✓/✗ Vrai/Faux' : '⚖️ Cas pratique'}
                </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-6 leading-snug">{question.question}</h3>
            
            {(question.type === 'mcq' || question.type === 'truefalse') && question.options && (
                <div className="space-y-3">
                    {question.options.map((opt, idx) => {
                        let btnClass = "w-full text-left p-4 rounded-xl border-2 transition-all text-sm font-medium flex items-center justify-between group ";
                        if (isAnswered) {
                            if (idx === question.correctAnswerIndex) btnClass += "bg-emerald-50 border-emerald-500 text-emerald-700";
                            else if (idx === selectedOption) btnClass += "bg-rose-50 border-rose-500 text-rose-700";
                            else btnClass += "bg-slate-50 border-transparent text-slate-400 opacity-50";
                        } else {
                            btnClass += "bg-white border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700 hover:shadow-md";
                        }
                        return (
                            <button key={idx} onClick={() => handleOptionClick(idx)} className={btnClass} disabled={isAnswered}>
                                <span>{opt}</span>
                                {isAnswered && idx === question.correctAnswerIndex && <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                                {isAnswered && idx === selectedOption && idx !== question.correctAnswerIndex && <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                            </button>
                        );
                    })}
                </div>
            )}

            {question.type === 'case' && (
                <div className="space-y-4">
                    <textarea
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="Rédigez votre réponse ici (5-10 lignes)..."
                        disabled={isAnswered}
                        className="w-full p-4 border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none resize-none min-h-[150px] text-sm leading-relaxed disabled:bg-slate-50 disabled:text-slate-500"
                        rows={6}
                    />
                    {!isAnswered && (
                        <button 
                            onClick={handleCaseSubmit}
                            disabled={!userAnswer.trim()}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            Soumettre ma réponse
                        </button>
                    )}
                </div>
            )}

            {isAnswered && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-4 duration-500 space-y-4">
                    {question.type === 'case' && aiEvaluation && (
                        <div className="p-5 rounded-xl text-sm leading-relaxed bg-blue-50 text-blue-900 border border-blue-100">
                            <div className="flex items-start gap-2 mb-2">
                                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <div>
                                    <span className="font-bold uppercase text-xs tracking-wider opacity-70 block mb-1">Évaluation</span>
                                    {aiEvaluation}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className={`p-5 rounded-xl text-sm leading-relaxed shadow-sm ${
                        question.type === 'case' ? 'bg-slate-50 text-slate-900 border border-slate-100' :
                        selectedOption === question.correctAnswerIndex ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'
                    }`}>
                        <div className="flex gap-2 mb-1">
                            <span className="font-bold uppercase text-xs tracking-wider opacity-70">Explication</span>
                        </div>
                        {question.explanation}
                    </div>
                    
                    <button onClick={nextQuestion} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex items-center justify-center gap-2">
                        {currentIndex < data.length - 1 ? "Question Suivante" : "Voir mon score"}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

// Help Modal Component
const HelpModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  const examples = [
    {
      icon: "❓",
      title: "Poser une question",
      example: "Qu'est-ce qu'un différend en droit international ?",
      color: "bg-blue-50 border-blue-200 text-blue-700"
    },
    {
      icon: "📝",
      title: "Demander un QCM",
      example: "Pose-moi un QCM sur la compétence de la CIJ",
      color: "bg-indigo-50 border-indigo-200 text-indigo-700"
    },
    {
      icon: "⚖️",
      title: "Demander un cas pratique",
      example: "Donne-moi un petit cas pratique sur les mesures conservatoires",
      color: "bg-purple-50 border-purple-200 text-purple-700"
    },
    {
      icon: "📚",
      title: "Demander une définition",
      example: "Définis le juge ad hoc",
      color: "bg-emerald-50 border-emerald-200 text-emerald-700"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Comment utiliser ADA ?</h2>
                <p className="text-indigo-100 text-sm mt-1">Votre assistante en Contentieux International</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {examples.map((item, idx) => (
            <div key={idx} className={`p-5 rounded-2xl border-2 ${item.color} transition-all hover:shadow-md`}>
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">{item.icon}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <div className="bg-white/60 rounded-xl p-3 font-mono text-sm border border-current/20">
                    "{item.example}"
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
          <p className="text-sm text-slate-600 text-center">
            💡 <span className="font-semibold">Astuce :</span> Soyez précis dans vos questions pour obtenir les meilleures réponses !
          </p>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const TextChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<{ file: File; base64: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const API_KEY = import.meta.env.VITE_API_KEY;
  const DEFAULT_WELCOME_MESSAGE: Message = { 
    role: 'model', 
    text: '### Bonjour !\n\nJe suis **ADA**, votre assistante juridique spécialisée en Contentieux International.\n\nJe peux vous aider sur les thèmes suivants :\n- **La Cour Internationale de Justice**\n- **La procédure contentieuse et consultative**\n- **La responsabilité internationale de l\'État**\n\nQuelle est votre question ?', 
    timestamp: new Date() 
  };

  useEffect(() => {
    const savedSessions = localStorage.getItem('juriste_admin_sessions');
    if (savedSessions) {
        try {
            const parsed: ChatSession[] = JSON.parse(savedSessions);
            const textSessions = parsed.filter((s: any) => s.mode === ChatMode.TEXT);
            const hydratedSessions = textSessions.map((s: any) => ({...s, messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))}));
            hydratedSessions.sort((a: any, b: any) => b.lastModified - a.lastModified);
            setSessions(hydratedSessions);
            if (hydratedSessions.length > 0) loadSession(hydratedSessions[0]);
            else createNewSession();
        } catch (e) { createNewSession(); }
    } else { createNewSession(); }
  }, []);

  const saveSessionsToStorage = (updatedSessions: ChatSession[]) => {
      const allSaved = localStorage.getItem('juriste_admin_sessions');
      let otherSessions: ChatSession[] = [];
      if (allSaved) {
          try {
            const parsed = JSON.parse(allSaved);
            otherSessions = parsed.filter((s: any) => s.mode !== ChatMode.TEXT);
          } catch(e) { console.error(e); }
      }
      localStorage.setItem('juriste_admin_sessions', JSON.stringify([...otherSessions, ...updatedSessions]));
  };

  const createNewSession = () => {
      const newId = Date.now().toString();
      const newSession: ChatSession = { id: newId, title: 'Nouvelle conversation', messages: [DEFAULT_WELCOME_MESSAGE], lastModified: Date.now(), mode: ChatMode.TEXT };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
      setMessages(newSession.messages);
      setShowHistory(false);
      saveSessionsToStorage([newSession, ...sessions]);
  };
  
  const loadSession = (session: ChatSession) => { 
      setCurrentSessionId(session.id); 
      setMessages(session.messages); 
      setShowHistory(false); 
  };
  
  const deleteSession = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newSessions = sessions.filter(s => s.id !== id);
      setSessions(newSessions);
      saveSessionsToStorage(newSessions);
      if (currentSessionId === id) { 
          if (newSessions.length > 0) loadSession(newSessions[0]); 
          else createNewSession(); 
      }
  };
  
  const startEditing = (e: React.MouseEvent, session: ChatSession) => { e.stopPropagation(); setEditingSessionId(session.id); setEditTitleInput(session.title); };
  const saveTitle = (id: string) => {
      const newSessions = sessions.map(s => s.id === id ? { ...s, title: editTitleInput } : s);
      setSessions(newSessions); saveSessionsToStorage(newSessions); setEditingSessionId(null);
  };
  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => { if (e.key === 'Enter') saveTitle(id); };
  
  const updateCurrentSession = (newMessages: Message[]) => {
      if (!currentSessionId) return;
      setMessages(newMessages);
      setSessions(prevSessions => {
          const updated = prevSessions.map(session => {
              if (session.id === currentSessionId) {
                  let title = session.title;
                  if (session.title === 'Nouvelle conversation' && newMessages.length > 1) {
                      const firstUserMsg = newMessages.find(m => m.role === 'user');
                      if (firstUserMsg) title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
                  }
                  return { ...session, messages: newMessages, title: title, lastModified: Date.now() };
              }
              return session;
          }).sort((a, b) => b.lastModified - a.lastModified);
          saveSessionsToStorage(updated);
          return updated;
      });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      if (e.target.files && e.target.files[0]) { 
          const file = e.target.files[0]; 
          try { 
              const base64 = await fileToBase64(file); 
              setAttachment({ file, base64 }); 
          } catch (err) { 
              console.error(err); 
          } 
      } 
  };
  
  const clearAttachment = () => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !attachment) || isLoading) return;
    if (!API_KEY) {
        const errorMsg: Message = { role: 'model', text: "### Erreur de Configuration\n\nLa clé API est manquante. Vérifiez `VITE_API_KEY`.", timestamp: new Date() };
        updateCurrentSession([...messages, errorMsg]);
        return;
    }

    const userMsg: Message = { 
      role: 'user', 
      text: attachment ? `[Fichier: ${attachment.file.name}] ${text}` : text, 
      timestamp: new Date() 
    };
    
    const newHistory = [...messages, userMsg];
    updateCurrentSession(newHistory);
    setInput(''); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const currentAttachment = attachment; 
    clearAttachment(); 
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const parts: any[] = [];
      if (currentAttachment) parts.push({ inlineData: { mimeType: currentAttachment.file.type, data: currentAttachment.base64 } });
      if (text.trim()) parts.push({ text: text });
      
      const result = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: parts }],
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      
      let fullText = '';
      const msgsWithModel = [...newHistory, { role: 'model', text: '', timestamp: new Date() } as Message];
      updateCurrentSession(msgsWithModel);

      for await (const chunk of result) {
          const chunkText = chunk.text; 
          if (chunkText) {
            fullText += chunkText;
            
            // Afficher pendant le streaming SAUF si ça ressemble à du JSON
            const trimmed = fullText.trim();
            const looksLikeJson = trimmed.startsWith('[') || trimmed.startsWith('```json') || trimmed.startsWith('```\n[');
            
            if (!looksLikeJson) {
                updateCurrentSession(msgsWithModel.map((m, i) => 
                    i === msgsWithModel.length - 1 ? { ...m, text: fullText } : m
                ));
            }
          }
      }

      // Nettoyage et détection du quiz JSON
      let cleanText = fullText.trim();

      // Retirer les balises markdown si présentes
      if (cleanText.startsWith('```json')) {
          cleanText = cleanText.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
      } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```\s*/, '').replace(/```\s*$/, '');
      }

      cleanText = cleanText.trim();

      // Détection du quiz JSON
      if (cleanText.startsWith('[') && cleanText.endsWith(']')) {
          try {
              const quizData = JSON.parse(cleanText);
              
              // Vérifier que c'est bien un tableau de questions
              if (Array.isArray(quizData) && quizData.length > 0 && quizData[0].type) {
                  const finalMsgWithQuiz: Message = { 
                      role: 'model', 
                      text: "", 
                      timestamp: new Date(),
                      isQuiz: true,
                      quizData:                    
                      quizData
};
updateCurrentSession([...newHistory, finalMsgWithQuiz]);
} else {
// Pas un quiz valide, afficher le texte
updateCurrentSession(msgsWithModel.map((m, i) =>
i === msgsWithModel.length - 1 ? { ...m, text: fullText } : m
));
}
} catch (e) {
console.error("Erreur parsing quiz:", e);
// Si le parsing échoue, afficher le texte brut
updateCurrentSession(msgsWithModel.map((m, i) =>
i === msgsWithModel.length - 1 ? { ...m, text: fullText } : m
));
}
} else {
// Ce n'est pas du JSON, afficher normalement
updateCurrentSession(msgsWithModel.map((m, i) =>
i === msgsWithModel.length - 1 ? { ...m, text: fullText } : m
));
}

setIsLoading(false);

} catch (error) {
  console.error(error);
  updateCurrentSession([...newHistory, { role: 'model', text: "Erreur de génération.", timestamp: new Date() }]);
  setIsLoading(false);
}

};
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
handleSend();
}
};
const handleSend = () => sendMessage(input);
useEffect(() => {
messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
useEffect(() => {
  if (textareaRef.current) {
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
  }
}, [input]);
const UserIcon = () => (
<div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md ring-2 ring-white">
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
</div>
);
const BotIcon = () => (
<div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md ring-2 ring-white relative">
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path></svg>
</div>
);
return (
<div className="flex h-[600px] relative bg-slate-50/50 overflow-hidden rounded-b-3xl">
<HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
{/* SIDEBAR */}
  <div 
    className={`absolute inset-y-0 left-0 z-30 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-100`}
  >
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Historique
          </h2>
          <button onClick={() => setShowHistory(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
      </div>
      
      <div className="p-4">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold shadow-sm active:scale-95 transform"
          >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              Nouvelle discussion
          </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
          {sessions.map(session => (
              <div 
                key={session.id}
                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${currentSessionId === session.id ? 'bg-indigo-50 text-indigo-800 border-indigo-100 shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:border-slate-100'}`}
                onClick={() => loadSession(session)}
              >
                  <div className={`p-2 rounded-lg ${currentSessionId === session.id ? 'bg-white text-indigo-500 shadow-sm' : 'bg-slate-100 text-slate-400 group-hover:bg-white'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  </div>
                  
                  {editingSessionId === session.id ? (
                      <input 
                        type="text" 
                        value={editTitleInput} 
                        onChange={(e) => setEditTitleInput(e.target.value)}
                        onBlur={() => saveTitle(session.id)}
                        onKeyDown={(e) => handleEditKeyDown(e, session.id)}
                        autoFocus
                        className="flex-1 min-w-0 text-sm px-1 py-0.5 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                  ) : (
                    <div className="flex-1 min-w-0">
                        <div className="truncate text-sm font-medium leading-5">
                            {session.title}
                        </div>
                        <div className="text-[10px] opacity-60 truncate mt-0.5">
                            {new Date(session.lastModified).toLocaleDateString()} • {new Date(session.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                  )}

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => startEditing(e, session)}
                        className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Renommer"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button 
                        onClick={(e) => deleteSession(e, session.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Supprimer"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
              </div>
          ))}
      </div>
  </div>
  
  {showHistory && (
    <div 
        className="absolute inset-0 bg-black/20 z-20 backdrop-blur-sm"
        onClick={() => setShowHistory(false)}
    ></div>
  )}

  {/* MAIN CHAT */}
  <div className="flex-1 flex flex-col relative w-full min-w-0 bg-white">
    
    <div className="absolute top-4 left-4 z-10">
        <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 bg-white/80 backdrop-blur shadow-sm border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-all"
            title="Afficher l'historique"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
    </div>

    <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth pt-16">
        {messages.map((msg, idx) => (
        <div
            key={idx}
            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
        >
            <div className="flex-shrink-0 mt-1">
            {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
            </div>
            
            <div
            className={`rounded-3xl px-6 py-5 shadow-sm ${
                msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-lg max-w-[75%]'
                : 'bg-white text-slate-800 rounded-tl-lg border border-slate-200 max-w-[85%]'
            } relative group`}
            >
                {msg.isQuiz && msg.quizData ? (
                    <QuizDisplay data={msg.quizData} />
                ) : (
                    <>
                        <SimpleMarkdown text={msg.text} isUser={msg.role === 'user'} />
                        
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100/50">
                            <div className={`text-[10px] font-medium ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
        ))}
        
        {isLoading && (
        <div className="flex gap-4 animate-pulse">
            <div className="flex-shrink-0 mt-1"><BotIcon /></div>
            <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-lg px-6 py-5 shadow-sm flex items-center space-x-1.5 h-16">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
        </div>
        )}
        <div ref={messagesEndRef} />
    </div>

    <div className="p-4 bg-white border-t border-slate-100 relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        
        {attachment && (
            <div className="mb-2 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium w-fit border border-indigo-100">
                <span className="truncate max-w-[200px]">{attachment.file.name}</span>
                <button onClick={clearAttachment} className="hover:text-indigo-900">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
        )}

        {!isLoading && !attachment && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center">
                
                {/* Bouton Aide */}
                <button 
                    onClick={() => setShowHelp(true)}
                    className="whitespace-nowrap px-4 py-2 bg-yellow-100 text-yellow-700 text-sm font-bold rounded-full border-2 border-yellow-200 hover:bg-yellow-200 hover:border-yellow-300 transition-all flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    Aide
                </button>
                
                {/* Bouton QCM */}
                <button 
                    onClick={() => sendMessage("Pose-moi un QCM sur le contentieux international")}
                    className="whitespace-nowrap px-4 py-2 bg-blue-100 text-blue-700 text-sm font-bold rounded-full border-2 border-blue-200 hover:bg-blue-200 hover:border-blue-300 transition-all flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                    </svg>
                    Pose-moi un QCM
                </button>
                
                {/* Bouton Cas pratique */}
                <button 
                    onClick={() => sendMessage("Donne-moi un petit cas pratique")}
                    className="whitespace-nowrap px-4 py-2 bg-purple-100 text-purple-700 text-sm font-bold rounded-full border-2 border-purple-200 hover:bg-purple-200 hover:border-purple-300 transition-all flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"></path>
                    </svg>
                    Donne-moi un petit cas pratique
                </button>
                
                {/* Bouton Définition */}
                <button 
                    onClick={() => {
                        setInput("Définis ou explique-moi : ");
                        textareaRef.current?.focus();
                    }}
                    className="whitespace-nowrap px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold rounded-full border-2 border-emerald-200 hover:bg-emerald-200 hover:border-emerald-300 transition-all flex items-center gap-2 shadow-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                    Définis ou explique-moi
                </button>

            </div>
        )}

        <div className="relative flex items-end gap-2 bg-slate-50 p-2 rounded-3xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-inner">
        
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".pdf,image/*" 
            className="hidden" 
        />
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 mb-1 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50"
            title="Joindre un document (PDF ou Image)"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
        </button>

        <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachment ? "Posez une question sur ce document..." : "Posez votre question juridique..."}
            className="flex-1 bg-transparent px-2 py-3 focus:outline-none text-slate-700 placeholder-slate-400 resize-none max-h-[150px] overflow-y-auto leading-normal"
            rows={1}
        />
        
        <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !attachment)}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-3 rounded-2xl transition-all shadow-md hover:shadow-lg flex-shrink-0 mb-0.5"
        >
            <svg className="w-5 h-5 transform rotate-90 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
        </button>
        </div>
    </div>
  </div>
</div>
);
};
export default TextChat;
