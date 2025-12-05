import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message, ChatSession, ChatMode } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';
import { decodeAudioData, playAudioBuffer } from '../utils/audio-utils';
import { fileToBase64, exportSessionToPDF } from '../utils/file-utils';

// ... (SimpleMarkdown et cleanTextForTTS inchangés, copiez-les ici si nécessaire) ...
// Note: Pour abréger, je remets l'essentiel du composant.
// Copiez vos helpers parseBold, SimpleMarkdown, cleanTextForTTS ici.

// ... (Début du composant TextChat identique) ...

const TextChat: React.FC = () => {
  // ... (States et Refs identiques) ...
  // Assurez-vous d'avoir : const [showHistory, setShowHistory] = useState(false);
  // Et : const [sessions, setSessions] = useState<ChatSession[]>([]);

  // ... (Hooks useEffect identiques) ...

  // ... (Fonctions createNewSession, loadSession, etc. identiques) ...

  // NOUVELLE FONCTION
  const handleExport = (e: React.MouseEvent, session: ChatSession) => {
      e.stopPropagation();
      exportSessionToPDF(session.title, session.messages);
  };

  // ... (Reste des fonctions sendMessage, etc. identiques) ...

  return (
    <div className="flex h-[600px] relative bg-slate-50/50 overflow-hidden">
      
      {/* SIDEBAR (HISTORY) */}
      <div 
        className={`absolute inset-y-0 left-0 z-30 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-100`}
      >
          {/* ... (Header Sidebar identique) ... */}
          
          {/* ... (Bouton Nouvelle discussion identique) ... */}

          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
              {sessions.map(session => (
                  <div 
                    key={session.id}
                    className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${currentSessionId === session.id ? 'bg-indigo-50 text-indigo-800 border-indigo-100 shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:border-slate-100'}`}
                    onClick={() => loadSession(session)}
                  >
                      {/* ... (Titre et Input d'édition identiques) ... */}

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* BOUTON EXPORT PDF AJOUTÉ ICI */}
                        <button 
                            onClick={(e) => handleExport(e, session)}
                            className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Exporter PDF"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                        {/* ... (Boutons Renommer et Supprimer existants) ... */}
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* ... (Reste du render identique) ... */}
    </div>
  );
};

export default TextChat;
