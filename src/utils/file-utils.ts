import { jsPDF } from "jspdf";

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the "data:*/*;base64," prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

export const exportSessionToPDF = (title: string, messages: { role: string, text: string, timestamp?: Date }[]) => {
    // Utilisation de l'import nommé pour éviter les erreurs de constructeur
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);
    let y = 20;

    // Configuration de la police pour supporter les accents basiques
    doc.setFont("helvetica", "bold");
    
    // Titre
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo
    // Nettoyage basique du titre pour éviter les caractères non supportés
    const cleanTitle = title.replace(/[^\x20-\x7EÀ-ÿ]/g, "");
    doc.text(cleanTitle, margin, y);
    y += 10;

    // Date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const dateStr = `Exporté le ${new Date().toLocaleDateString()}`;
    doc.text(dateStr, margin, y);
    y += 15;

    // Contenu
    messages.forEach((msg) => {
        // Vérification saut de page
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        // En-tête du message (Rôle)
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        if (msg.role === 'user') {
            doc.setTextColor(30, 64, 175); // Bleu pour l'utilisateur
            doc.text("Vous :", margin, y);
        } else {
            doc.setTextColor(16, 185, 129); // Émeraude pour l'IA
            doc.text("ADA (Assistant) :", margin, y);
        }
        y += 7;

        // Corps du message
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);

        // Nettoyage du texte pour le PDF (retrait du markdown et caractères spéciaux problématiques)
        let cleanText = msg.text || "";
        cleanText = cleanText
            .replace(/\*\*/g, '') // Gras
            .replace(/###/g, '')  // Titres
            .replace(/##/g, '')
            .replace(/-/g, '•'); // Puces

        // Découpage du texte pour tenir dans la largeur
        const splitText = doc.splitTextToSize(cleanText, maxLineWidth);
        doc.text(splitText, margin, y);
        
        // Calcul de la nouvelle position Y
        y += (splitText.length * 5) + 10;
    });

    doc.save(`session-${new Date().toISOString().split('T')[0]}.pdf`);
};
