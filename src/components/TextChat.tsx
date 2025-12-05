import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message, ChatSession, ChatMode, QuizQuestion } from '../types';
import { SYSTEM_INSTRUCTION, GLOSSARY_DATA } from '../constants';
import { decodeAudioData, playAudioBuffer } from '../utils/audio-utils';
import { fileToBase64, exportSessionToPDF } from '../utils/file-utils';

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
    
    // Titles (###)
    if (line.startsWith('### ')) {
      flushList(`list-before-${index}`);
      elements.push(
        <h3 key={`h3-${index}`} className={`text-lg font-bold mt-6 mb-3 ${isUser ? 'text-white' : 'text-indigo-800 border-b border-indigo-100 pb-1'}`}>
          {parseBold(line.replace('### ', ''))}
        </h3>
      );
    } 
    // Titles (##)
    else if (line.startsWith('## ')) {
        flushList(`list-before-${index}`);
        elements.push(
          <h2 key={`h2-${index}`} className={`text-xl font-extrabold mt-8 mb-4 ${isUser ? 'text-white' : 'text-indigo-900'}`}>
            {parseBold(line.replace('## ', ''))}
          </h2>
        );
      }
    // Titles (#### or #####) -> Bold Paragraphs
    else if (line.startsWith('#### ') || line.startsWith('##### ')) {
        flushList(`list-before-${index}`);
        elements.push(
          <p key={`h-bold-${index}`} className={`font-bold mt-4 mb-2 text-base ${isUser ? 'text-white' : 'text-indigo-700'}`}>
            {parseBold(line.replace(/#{4,5} /, ''))}
          </p>
        );
    }
    // List items
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(
        <li key={`item-${index}`} className="pl-1 leading-relaxed">
          {parseBold(line.replace(/^[-*] /, ''))}
        </li>
      );
    } 
    // Standard paragraphs
    else {
      if (trimmedLine !== '') {
        flushList(`list-before-${index}`);
        elements.push(
          <p key={`p-${index}`} className="mb-4 last:mb-0 leading-relaxed text-slate-700">
            {parseBold(line)}
          </p>
        );
      } else {
          // Empty line, maybe flush list
          flushList(`list-before-${index}`);
      }
    }
  });

  flushList('list-end');

  return <div className={`text-[15px] ${isUser ? 'leading-relaxed text-white' : 'leading-8 text-slate-800'}`}>{elements}</div>;
};

const cleanTextForTTS = (text: string) => {
    return text
        .replace(/[*#]/g, '') 
        .replace(/- /g, '') 
        .trim();
};

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
    <div className="absolute inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex justify-end transition-all duration-300">
      <div className="w-full md:w-[400px] bg-white h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
            </div>
            Glossaire
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        
        <div className="relative mb-6">
            <input type="text" placeholder="Rechercher un terme..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none text-sm transition-all" />
            <svg className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 scroll-smooth">
            {filtered.map((item, idx) => (
                <div key={idx} className="p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-200 group">
                    <h3 className="font-bold text-indigo-700 mb-1 group-hover:text-indigo-600">{item.term}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.definition}</p>
                </div>
            ))}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                    <p>Aucun terme trouvé.</p>
                </div>
            )}
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
            <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-3xl border border-indigo-100 text-center shadow-sm">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    {Math.round((score / data.length) * 100)}%
                </div>
                <h3 className="text-2xl font-bold text-indigo-900 mb-2">Quiz Terminé !</h3>
                <p className="text-lg mb-6 text-slate-600">Votre score : <span className="font-bold text-indigo-600">{score} / {data.length}</span></p>
                
                <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                    <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${(score / data.length) * 100}%` }}></div>
                </div>
                
                <p className="text-sm font-medium text-slate-500 bg-slate-50 py-2 px-4 rounded-lg inline-block">
                    {score === data.length ? "?
