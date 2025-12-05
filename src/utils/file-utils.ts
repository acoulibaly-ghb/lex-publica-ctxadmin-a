import jsPDF from 'jspdf';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxLineWidth = pageWidth - (margin * 2);
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(title, margin, y);
    y += 10;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exporté le ${new Date().toLocaleDateString()} à ${new Date().toLocaleTimeString()}`, margin, y);
    y += 15;

    // Content
    messages.forEach((msg) => {
        // Check page break
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        // Role Header
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        if (msg.role === 'user') {
            doc.setTextColor(30, 64, 175); // Blue for user
            doc.text("Vous :", margin, y);
        } else {
            doc.setTextColor(16, 185, 129); // Emerald for AI
            doc.text("ADA (Assistant) :", margin, y);
        }
        y += 7;

        // Message Body
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);

        // Clean text (remove markdown basics for PDF readability)
        const cleanText = msg.text.replace(/\*\*/g, '').replace(/###/g, '').replace(/-/g, '•');
        
        const splitText = doc.splitTextToSize(cleanText, maxLineWidth);
        doc.text(splitText, margin, y);
        
        y += (splitText.length * 5) + 10;
    });

    doc.save(`session-${new Date().toISOString().split('T')[0]}.pdf`);
};
