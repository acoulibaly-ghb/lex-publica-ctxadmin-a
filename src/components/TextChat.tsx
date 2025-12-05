
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message, ChatSession, ChatMode, GlossaryItem, QuizQuestion } from '../types';
import { SYSTEM_INSTRUCTION, GLOSSARY_DATA } from '../constants';
import { decodeAudioData, playAudioBuffer } from '../utils/audio-utils';
import { fileToBase64, exportSessionToPDF } from '../utils/file-utils';

// --- Markdown Component Helper ---
const parseBold = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold underline decoration-indigo-300/50 underline-offset-2">{part.slice(2, -2)}</strong>;
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
      elements.push(<ul key={key} className="list-disc pl-5 mb-4 space-y-2 marker:text-indigo-400">{[...currentList]}</ul>);
      currentList = [];
    }
  };
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (line.startsWith('### ')) {
      flushList(`list-before-${index}`);
      elements.push(<h3 key={`h3-${index}`} className={`text-lg font-bold mt-6 mb-3 ${isUser ? 'text-white' : 'text-indigo-800'}`}>{parseBold(line.replace('### ', ''))}</h3>);
    } else if (line.startsWith('## ')) {
        flushList(`list-before-${index}`);
        elements.push(<h2 key={`h2-${index}`} className={`text-xl font-bold mt-7 mb-4 ${isUser ? 'text-white' : 'text-indigo-900'}`}>{parseBold(line.replace('## ', ''))}</h2>);
    } else if (line.startsWith('#### ') || line.startsWith('##### ')) {
        flushList(`list-before-${index}`);
        elements.push(<p key={`h-bold-${index}`} className={`font-bold mt-4 mb-2 ${isUser ? 'text-white' : 'text-indigo-700'}`}>{parseBold(line.replace(/#{4,5} /, ''))}</p>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(<li key={`item-${index}`} className="pl-1">{parseBold(line.replace(/^[-*] /, ''))}</li>);
    } else {
      if (trimmedLine !== '') {
        flushList(`list-before-${index}`);
        elements.push(<p key={`p-${index}`} className="mb-4 last:mb-0">{parseBold(line)}</p>);
      } else { flushList(`list-before-${index}`); }
    }
  });
  flushList('list-end');
  return <div className={`text-[15px] ${isUser ? 'leading-relaxed' : 'leading-8'}`}>{elements}</div>;
};

const cleanTextForTTS = (text: string) => text.replace(/[*#]/g, '').replace(/- /g, '').trim();

// --- COMPONENTS ---

// 1. Glossary Modal
const GlossaryModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;

  const filtered = GLOSSARY_DATA.filter(item => 
    item.term.toLowerCase().includes(search.toLowerCase()) || 
    item.definition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
      <div className="w-full md:w-96 bg-white h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            Glossaire
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        
        <div className="relative mb-4">
            <input type="text" placeholder="Rechercher un terme..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm" />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {filtered.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors">
                    <h3 className="font-bold text-indigo-700 mb-1">{item.term}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.definition}</p>
                </div>
            ))}
            {filtered.length === 0 && <p className="text-center text-slate-400 mt-10">Aucun terme trouvé.</p>}
        </div>
      </div>
    </div>
  );
};

// 2. Quiz Component
const QuizDisplay = ({ data }: { data: QuizQuestion[] }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [score, setScore] = useState(0);
    const [showScore, setShowScore] = useState(false);

    const question = data[currentIndex];

    const handleOptionClick = (idx: number) => {
        if (isAnswered) return;
        setSelectedOption(idx);
        setIsAnswered(true);
        if (idx === question.correctAnswerIndex) setScore(s => s + 1);
    };

    const nextQuestion = () => {
        if (currentIndex < data.length - 1) {
            setCurrentIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsAnswered(false);
        } else {
            setShowScore(true);
        }
    };

    if (showScore) {
        return (
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 text-center">
                <h3 className="text-2xl font-bold text-indigo-800 mb-2">Quiz Terminé !</h3>
                <p className="text-lg mb-4">Votre score : <span className="font-bold text-indigo-600">{score} / {data.length}</span></p>
                <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${(score / data.length) * 100}%` }}></div>
                </div>
                <p className="text-sm text-slate-500">{score === data.length ? "Excellent ! Maîtrise parfaite." : score > data.length/2 ? "Bon travail !" : "Continuez à réviser le glossaire."}</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mt-2">
            <div className="flex justify-between items-center mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>Question {currentIndex + 1}/{data.length}</span>
                <span>Quiz</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-6">{question.question}</h3>
            <div className="space-y-3">
                {question.options.map((opt, idx) => {
                    let btnClass = "w-full text-left p-4 rounded-xl border transition-all text-sm font-medium ";
                    if (isAnswered) {
                        if (idx === question.correctAnswerIndex) btnClass += "bg-emerald-100 border-emerald-500 text-emerald-800";
                        else if (idx === selectedOption) btnClass += "bg-red-100 border-red-500 text-red-800";
                        else btnClass += "bg-slate-50 border-slate-200 text-slate-400";
                    } else {
                        btnClass += "bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700";
                    }
                    return (
                        <button key={idx} onClick={() => handleOptionClick(idx)} className={btnClass} disabled={isAnswered}>
                            {opt}
                        </button>
                    );
                })}
            </div>
            {isAnswered && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                    <div className={`p-4 rounded-xl text-sm leading-relaxed mb-4 ${selectedOption === question.correctAnswerIndex ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'}`}>
                        <strong>Explication :</strong> {question.explanation}
                    </div>
                    <button onClick={nextQuestion} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                        {currentIndex < data.length - 1 ? "Question Suivante" : "Voir mon score"}
                    </button>
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---

const TextChat: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showGlossary, setShowGlossary] = useState(false); // New state for Glossary
  
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null); // Track which message is speaking
  const [attachment, setAttachment] = useState<{ file: File; base64: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const API_KEY = import.meta.env.VITE_API_KEY;
  const DEFAULT_WELCOME_MESSAGE: Message = { role: 'model', text: '### Bonjour !\n\nJe suis **ADA**, votre assistante juridique spécialisée en Contentieux International.\n\nJe peux vous aider sur :\n- **La CIJ** et sa compétence\n- **La responsabilité internationale**\n- **La procédure** (arrêts, avis)\n\nUtilisez les boutons ci-dessous pour vous entraîner !', timestamp: new Date() };
  const suggestions = ["Qu'est-ce qu'un différend ?", "L'affaire Mavrommatis", "Avis consultatif vs Arrêt"];

  useEffect(() => {
    const savedSessions = localStorage.getItem('juriste_admin_sessions');
    if (savedSessions) {
        try {
            const parsed: ChatSession[] = JSON.parse(savedSessions);
            const textSessions = parsed.filter(s => s.mode === ChatMode.TEXT);
            const hydratedSessions = textSessions.map(s => ({...s, messages: s.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))}));
            hydratedSessions.sort((a, b) => b.lastModified - a.lastModified);
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
  const loadSession = (session: ChatSession) => { setCurrentSessionId(session.id); setMessages(session.messages); setShowHistory(false); };
  const deleteSession = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const newSessions = sessions.filter(s => s.id !== id); setSessions(newSessions); saveSessionsToStorage(newSessions); if (currentSessionId === id) { if (newSessions.length > 0) loadSession(newSessions[0]); else createNewSession(); } };
  const startEditing = (e: React.MouseEvent, session: ChatSession) => { e.stopPropagation(); setEditingSessionId(session.id); setEditTitleInput(session.title); };
  const saveTitle = (id: string) => { const newSessions = sessions.map(s => s.id === id ? { ...s, title: editTitleInput } : s); setSessions(newSessions); saveSessionsToStorage(newSessions); setEditingSessionId(null); };
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

  const handleExport = (e: React.MouseEvent, session: ChatSession) => { e.stopPropagation(); exportSessionToPDF(session.title, session.messages); };

  // --- TTS ---
  const handlePlayMessage = async (text: string, msgIdx: number) => {
    if (playingMessageId === msgIdx) return; // Prevent double click
    setPlayingMessageId(msgIdx);
    const cleanText = cleanTextForTTS(text);
    
    try {
        if (!API_KEY) throw new Error("API Key missing");
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanText }] }],
            config: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data");

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

        const audioBuffer = await decodeAudioData(base64Audio, audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setPlayingMessageId(null);
        source.start();
    } catch (e) {
        console.error(e);
        setPlayingMessageId(null);
    }
  };

  // --- QUIZ & HANDLERS ---
  const handleQuizMode = () => {
    sendMessage("Génère 3 questions de QCM sur le droit du contentieux international au format JSON strict.");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; try { const base64 = await fileToBase64(file); setAttachment({ file, base64 }); } catch (err) { console.error(err); } } };
  const clearAttachment = () => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !attachment) || isLoading) return;
    if (!API_KEY) return;

    const userMsg: Message = { role: 'user', text: attachment ? `[Fichier: ${attachment.file.name}] ${text}` : text, timestamp: new Date() };
    const newHistory = [...messages, userMsg];
    updateCurrentSession(newHistory);
    setInput(''); if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const currentAttachment = attachment; clearAttachment(); setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: API_KEY });
      const parts: any[] = [];
      if (currentAttachment) parts.push({ inlineData: { mimeType: currentAttachment.file.type, data: currentAttachment.base64 } });
      if (text.trim()) parts.push({ text: text });
      
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: parts }],
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });
      
      const responseText = result.text || "";
      let botMsg: Message = { role: 'model', text: responseText, timestamp: new Date() };

      // Detect JSON for Quiz
      if (responseText.trim().startsWith('[') && responseText.trim().endsWith(']')) {
          try {
              const quizData = JSON.parse(responseText);
              botMsg.isQuiz = true;
              botMsg.quizData = quizData;
              botMsg.text = "Voici un petit test de connaissances :"; // Fallback text
          } catch (e) {
              console.warn("Failed to parse Quiz JSON", e);
          }
      }

      updateCurrentSession([...newHistory, botMsg]);
    } catch (error) {
      console.error(error);
      updateCurrentSession([...newHistory, { role: 'model', text: "Erreur de génération.", timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="flex h-[600px] relative bg-slate-50/50 overflow-hidden">
      <GlossaryModal isOpen={showGlossary} onClose={() => setShowGlossary(false)} />

      {/* SIDEBAR */}
      <div className={`absolute inset-y-0 left-0 z-30 w-80 bg-white shadow-2xl transform transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-100`}>
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><h2 className="font-bold text-slate-700">Historique</h2><button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>
          <div className="p-4"><button onClick={createNewSession} className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-semibold shadow-sm">Nouvelle discussion</button></div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
              {sessions.map(s => (
                  <div key={s.id} className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer border ${currentSessionId === s.id ? 'bg-indigo-50 border-indigo-100 text-indigo-800' : 'hover:bg-slate-50 border-transparent text-slate-600'}`} onClick={() => loadSession(s)}>
                      {editingSessionId === s.id ? <input value={editTitleInput} onChange={e => setEditTitleInput(e.target.value)} onBlur={() => saveTitle(s.id)} onKeyDown={e => handleEditKeyDown(e, s.id)} autoFocus onClick={e => e.stopPropagation()} className="flex-1 min-w-0 text-sm px-1 py-0.5 border border-indigo-300 rounded" /> : <div className="flex-1 min-w-0 truncate text-sm font-medium">{s.title}</div>}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleExport(e, s)} className="p-1.5 text-slate-400 hover:text-emerald-500 rounded-lg" title="PDF"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
                        <button onClick={(e) => startEditing(e, s)} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                        <button onClick={(e) => deleteSession(e, s.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                      </div>
                  </div>
              ))}
          </div>
      </div>
      {showHistory && <div className="absolute inset-0 bg-black/20 z-20 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>}

      {/* CHAT AREA */}
      <div className="flex-1 flex flex-col relative w-full min-w-0 bg-white">
        <div className="absolute top-4 left-4 z-10">
            <button onClick={() => setShowHistory(!showHistory)} className="p-2 bg-white/80 backdrop-blur shadow-sm border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 transition-all"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
        </div>
        <div className="absolute top-4 right-4 z-10">
            <button onClick={() => setShowGlossary(true)} className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur shadow-sm border border-indigo-100 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-all text-sm font-semibold">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                Glossaire
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth pt-16">
            {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className="flex-shrink-0 mt-1">
                    {msg.role === 'user' ? <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div> 
                    : <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/></svg></div>}
                </div>
                
                <div className={`max-w-[85%] relative group ${msg.role === 'user' ? '' : 'w-full'}`}>
                     {msg.isQuiz && msg.quizData ? (
                        <QuizDisplay data={msg.quizData} />
                     ) : (
                        <div className={`rounded-3xl px-6 py-5 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-lg' : 'bg-white text-slate-800 rounded-tl-lg border border-slate-200'}`}>
                            <SimpleMarkdown text={msg.text} isUser={msg.role === 'user'} />
                            <div className="flex items-center justify-between mt-2">
                                <div className={`text-[10px] opacity-70 ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                {msg.role === 'model' && !isLoading && idx === messages.length - 1 && (
                                    <button onClick={() => handlePlayMessage(msg.text, idx)} className={`p-1.5 rounded-full transition-colors ${playingMessageId === idx ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'hover:bg-slate-100 text-slate-400 hover:text-indigo-600'}`} title="Lire à haute voix">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                     )}
                </div>
            </div>
            ))}
            {isLoading && <div className="flex gap-4 animate-pulse"><div className="w-8 h-8 bg-slate-200 rounded-full"></div><div className="bg-white border border-slate-200 rounded-3xl rounded-tl-lg px-6 py-5 shadow-sm w-24 h-16"></div></div>}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-slate-100 relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            {attachment && <div className="mb-2 flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-medium w-fit border border-indigo-100"><span className="truncate max-w-[200px]">{attachment.file.name}</span><button onClick={clearAttachment}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>}
            {messages.length < 3 && !isLoading && !attachment && <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide items-center">
                <button onClick={handleQuizMode} className="whitespace-nowrap px-3 py-1.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200 hover:bg-rose-200 transition-colors flex items-center gap-1 shadow-sm"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>Mode Quiz</button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                {suggestions.map((s, i) => <button key={i} onClick={() => sendMessage(s)} className="whitespace-nowrap px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-medium rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors">{s}</button>)}
            </div>}
            <div className="relative flex items-end gap-2 bg-slate-50 p-2 rounded-3xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100 transition-all shadow-inner">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".pdf,image/*" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="p-2 mb-1 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg></button>
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSend();}}} placeholder={attachment ? "Question sur le document..." : "Posez votre question..."} className="flex-1 bg-transparent px-2 py-3 focus:outline-none text-slate-700 placeholder-slate-400 resize-none max-h-[150px] overflow-y-auto leading-normal" rows={1} />
                <button onClick={handleSend} disabled={isLoading || (!input.trim() && !attachment)} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white p-3 rounded-2xl transition-all shadow-md mb-0.5"><svg className="w-5 h-5 transform rotate-90 translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg></button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default TextChat;
