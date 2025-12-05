import React, { useState, useRef, useEffect } from 'react';
// ... (Autres imports)
import { exportSessionToPDF } from '../utils/file-utils'; // Import ajouté

// ... (Début du composant VoiceChat identique) ...

const VoiceChat: React.FC = () => {
  // ... (States et Refs identiques) ...

  // NOUVELLE FONCTION
  const handleExport = (e: React.MouseEvent, session: ChatSession) => {
      e.stopPropagation();
      // Conversion des transcripts (format spécifique voix) vers le format Message pour le PDF
      const messages = (session.transcripts || []).map(t => ({
          role: t.role,
          text: t.text,
          timestamp: new Date(session.lastModified) // Date approximative
      }));
      exportSessionToPDF(session.title, messages);
  };

  // ... (Reste des fonctions identiques) ...

  return (
    <div className="flex h-[600px] relative bg-[#0f172a] overflow-hidden rounded-b-3xl">
      
      {/* SIDEBAR */}
      <div className={`absolute inset-y-0 left-0 z-30 w-80 bg-slate-900/95 backdrop-blur shadow-xl transform transition-transform duration-300 ease-in-out ${showHistory ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-slate-800`}>
          {/* ... (Header Sidebar identique) ... */}
          
          <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
              {sessions.map(session => (
                  <div key={session.id} className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-transparent ${currentSessionId === session.id ? 'bg-indigo-900/50 text-indigo-100 border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400 hover:border-slate-700'}`} onClick={() => loadVoiceSession(session)}>
                      <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium">{session.title}</div>
                          <div className="text-[10px] opacity-60 truncate mt-0.5">{new Date(session.lastModified).toLocaleDateString()}</div>
                      </div>
                      
                      {/* BOUTON EXPORT PDF */}
                      <button onClick={(e) => handleExport(e, session)} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/30 rounded-lg transition-all" title="Exporter Transcription">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </button>
                  </div>
              ))}
          </div>
      </div>

      {/* ... (Reste du render identique) ... */}
    </div>
  );
};

export default VoiceChat;
