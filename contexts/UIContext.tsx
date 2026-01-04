
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ViewState, SelectionState } from '../types';
import { Toast } from '../components/UI';
import * as Storage from '../services/storageService';

interface UIContextType {
  view: ViewState;
  setView: (view: ViewState) => void;
  selection: SelectionState;
  setSelection: (selection: SelectionState) => void;
  editingMonitoringId: string | null;
  setEditingMonitoringId: (id: string | null) => void;
  showNotification: (message: string, type: 'success' | 'warning' | 'error') => void;
  isOnline: boolean;
  headerTitle: string;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setView] = useState<ViewState>('home');

  // --- STICKY CONTEXT: Initialize from LocalStorage ---
  const [selection, setSelection] = useState<SelectionState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ingmarcon_selection');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Error reading selection from localStorage', e);
      }
    }
    return { companyId: null, fieldId: null, plotId: null, seasonId: null };
  });

  // --- STICKY CONTEXT: Persist to LocalStorage ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ingmarcon_selection', JSON.stringify(selection));
    }
  }, [selection]);

  const [editingMonitoringId, setEditingMonitoringId] = useState<string | null>(null);

  // Connectivity
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'warning' | 'error' }>({
    show: false, message: '', type: 'success'
  });

  const showNotification = (message: string, type: 'success' | 'warning' | 'error') => {
    setToast({ show: true, message, type });
  };

  useEffect(() => {
    if (navigator.onLine) Storage.processUploadQueue();

    const handleOnline = () => {
      setIsOnline(true);
      Storage.processUploadQueue();
      showNotification("Conexión recuperada. Sincronizando...", 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showNotification("Modo Offline activo.", 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getHeaderTitle = () => {
    if (view === 'home') return 'Inicio / Muestreos';
    if (view === 'manage-team') return 'Gestión de Equipo y Clientes';
    if (view === 'structure-hub') return 'Empresas y Lotes';
    if (view === 'history') return 'Historial Muestreos';
    if (view === 'analytics') return 'Dashboard de Cierres';
    if (view === 'recipes') return 'Recetas Agronómicas';
    if (view === 'manage-crops') return 'Catálogo de Cultivos';
    if (view === 'manage-pests') return 'Catálogo de Plagas';
    if (view === 'manage-seasons') return 'Gestión de Campañas';
    if (view === 'manage-agrochemicals') return 'Catálogo de Insumos';
    if (view === 'manage-tasks') return 'Catálogo de Labores';
    if (view === 'crop-assignments') return 'Asignación de Cultivos';
    if (view === 'budget-manager') return 'Gestión de Presupuestos';
    if (view.startsWith('manage-')) return 'Gestión';
    return 'Ing Marcon V1.0';
  };

  return (
    <UIContext.Provider value={{
      view,
      setView,
      selection,
      setSelection,
      editingMonitoringId,
      setEditingMonitoringId,
      showNotification,
      isOnline,
      headerTitle: getHeaderTitle()
    }}>
      {children}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
