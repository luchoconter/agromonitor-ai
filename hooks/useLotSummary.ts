
import { useState } from 'react';
import * as Storage from '../services/storageService';

interface UseLotSummaryParams {
  currentUser: any;
  dataOwnerId: string | null;
  dataOwnerName?: string;
  selection: {
    companyId: string | null;
    fieldId: string | null;
    plotId: string | null;
    seasonId: string | null;
  };
  showNotification: (msg: string, type: 'success' | 'warning' | 'error') => void;
  onSuccess: () => void;
}

export const useLotSummary = ({
  currentUser,
  dataOwnerId,
  dataOwnerName,
  selection,
  showNotification,
  onSuccess
}: UseLotSummaryParams) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<'verde' | 'amarillo' | 'rojo' | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModal = () => {
    setStatus(null);
    setNotes('');
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const submitSummary = async (audioBlobUrl: string | null, audioDuration: number) => {
    if (!status) {
      alert("Por favor indique el estado general del lote.");
      return;
    }
    if (!selection.companyId || !selection.fieldId || !selection.plotId || !selection.seasonId || !dataOwnerId || !currentUser) {
       showNotification("Faltan datos de contexto", "error");
       return; 
    }

    setIsSubmitting(true);
    try {
        await Storage.addLotSummary({
            companyId: selection.companyId,
            fieldId: selection.fieldId,
            plotId: selection.plotId,
            seasonId: selection.seasonId,
            userId: currentUser.id,
            userName: currentUser.name, // NEW: Save user name
            ownerId: dataOwnerId,
            ownerName: dataOwnerName,
            date: new Date().toISOString(),
            status: status,
            notes: notes,
            audioDuration: audioDuration
        }, audioBlobUrl || undefined);
    
        if (navigator.onLine) showNotification("Lote finalizado. Datos subidos.", 'success');
        else showNotification("Lote finalizado. Pendiente de subida.", 'warning');
    
        onSuccess();
        closeModal();
    } catch (error) {
        console.error(error);
        showNotification("Error al finalizar el lote", 'error');
    } finally {
        setIsSubmitting(false);
    }
  };

  return {
    isOpen,
    status,
    notes,
    isSubmitting,
    openModal,
    closeModal,
    setStatus,
    setNotes,
    submitSummary
  };
};
