import React, { useState, useEffect } from 'react';
import {
  Settings, ClipboardList, History, BarChart3, Users, LayoutList, Layers, Wheat, Bug, Sprout, Menu, X, LogOut, Sun, Moon, FlaskConical, ListTodo, FileText, Calendar, CloudOff, Cloud, RefreshCw, CheckCircle, AlertCircle, Loader2, Circle, StopCircle, Play, Save, Trash2, Wallet, Download, Route
} from 'lucide-react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { getSyncStatus, getQueue } from '../services/offlineQueueService';
import { syncPendingOperations } from '../services/autoSyncService';
import { useTracking } from '../contexts/TrackingContext';
import { Modal } from './UI'; // Ensure Modal is imported if it exists, otherwise use custom div

import { TrackingStartModal } from './tracking/TrackingStartModal';
import { InstallInstructionsModal } from './InstallInstructionsModal';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { currentUser, logout, isDarkMode, toggleTheme } = useAuth();
  const { view: currentView, setView: onNavigate, headerTitle } = useUI();
  const { isTracking, isPaused, startTracking, pauseTracking, resumeTracking, finishTracking, distanceTraveled, elapsedTime } = useTracking();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showOfflineDetails, setShowOfflineDetails] = useState(false);

  // New: Stop Modal State
  const [showStopModal, setShowStopModal] = useState(false);
  // New: Start Modal State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // New: PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // New: Track Metadata State
  const [trackName, setTrackName] = useState('');
  const [trackNotes, setTrackNotes] = useState('');
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  useEffect(() => {
    // Detect Standalone Mode
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent browser default
      e.preventDefault();
      // Store event
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      // If no prompt available (iOS or already dismissed), show manual instructions
      setShowInstallModal(true);
    }
  };

  // Monitor connection status and pending operations
  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      const syncStatus = getSyncStatus();
      setPendingCount(syncStatus.pendingCount);
      setIsSyncing(syncStatus.isSyncing);
      setLastSync(syncStatus.lastSync);
    };

    updateStatus();

    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check every 2 seconds for pending operations
    const interval = setInterval(updateStatus, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Sincronización manual
  const handleManualSync = async () => {
    if (!isOnline || isSyncing || pendingCount === 0) return;

    setIsSyncing(true);
    try {
      await syncPendingOperations();
    } catch (error) {
      console.error('Error en sincronización manual:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Formatear tiempo desde última sincronización
  const getLastSyncText = () => {
    if (!lastSync) return 'Nunca';

    const diff = Date.now() - lastSync;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours}h`;
    return 'Hace más de 24h';
  };

  // Helper: Format Elapsed Time (Seconds -> HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStopClick = async () => {
    await pauseTracking();
    setIsSavingDetails(false);
    setShowStopModal(true);
  };

  const handleContinue = async () => {
    await resumeTracking();
    setShowStopModal(false);
  };

  const handleSave = async () => {
    await finishTracking(true, trackName, trackNotes);
    setShowStopModal(false);
    setTrackName('');
    setTrackNotes('');
  };

  const handleDiscard = async () => {
    await finishTracking(false);
    setShowStopModal(false);
  };

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    if (!showOfflineDetails) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.offline-dropdown-container')) {
        setShowOfflineDetails(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOfflineDetails]);

  if (!currentUser) return null; // Safety check

  const renderNavItems = () => {
    const renderItem = (id: ViewState, label: string, Icon: React.ElementType) => {
      if (currentUser?.role === 'operator' && ['analytics', 'recipes', 'crop-assignments', 'structure-hub', 'manage-seasons', 'manage-crops', 'manage-pests', 'manage-agrochemicals', 'manage-tasks', 'manage-team'].includes(id)) return null;

      // MODIFICADO: Cliente (Company) solo ve Dashboard. Se ocultan home, history y todo lo de gestión.
      if (currentUser?.role === 'company' && [
        'home',
        'history',
        'sampling',
        'crop-assignments',
        'structure-hub',
        'manage-seasons',
        'manage-crops',
        'manage-pests',
        'manage-agrochemicals',
        'manage-tasks',
        'manage-team'
      ].includes(id)) return null;

      return (
        <button
          key={id}
          onClick={() => {
            onNavigate(id);
            setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-left ${currentView === id ? 'bg-agro-50 dark:bg-agro-900/30 text-agro-700 dark:text-agro-400 border-l-4 border-agro-600 dark:border-agro-500' : 'text-gray-600 dark:text-blue-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
        >
          <Icon className={`w-5 h-5 ${currentView === id ? 'text-agro-600 dark:text-agro-400' : 'text-gray-400 dark:text-blue-300'}`} />
          <span className="font-medium">{label}</span>
        </button>
      );
    };

    return (
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {renderItem('home', 'Inicio / Muestreo', ClipboardList)}

        {(currentUser?.role === 'admin' || currentUser?.role === 'company') && (
          <>
            {renderItem('history', 'Historial Muestreos', History)}
            {renderItem('recipes', 'Recetas', FileText)}
            {renderItem('analytics', 'Dashboard', BarChart3)}
            {renderItem('budget-manager', 'Presupuestos', Wallet)}
            {renderItem('track-history', 'Rutas GPS', Route)}
          </>
        )}

        {currentUser?.role === 'admin' && (
          <>
            <div className="pt-6 pb-2 px-4"><p className="text-xs font-semibold text-gray-400 dark:text-blue-300 uppercase tracking-wider">Gestión</p></div>
            {renderItem('manage-team', 'Equipo y Clientes', Users)}
            {renderItem('crop-assignments', 'Asignación Cultivos', LayoutList)}
            {renderItem('structure-hub', 'Empresas/Lotes', Layers)}

            <div className="pt-4 pb-2 px-4"><p className="text-xs font-semibold text-gray-400 dark:text-blue-300 uppercase tracking-wider">Catálogos</p></div>
            {renderItem('manage-seasons', 'Campañas', Calendar)}
            {renderItem('manage-agrochemicals', 'Insumos', FlaskConical)}
            {renderItem('manage-tasks', 'Labores', ListTodo)}
            {renderItem('manage-crops', 'Cultivos', Wheat)}
            {renderItem('manage-pests', 'Plagas', Bug)}
          </>
        )}
      </nav>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-900 overflow-hidden font-sans text-gray-800 dark:text-gray-100 relative">
      {/* START TRACKING MODAL */}
      <TrackingStartModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        onStart={(cid, fids) => {
          startTracking(cid, fids);
          setIsTrackingModalOpen(false);
        }}
      />


      {/* INSTALL INSTRUCTIONS MODAL */}
      <InstallInstructionsModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        isIOS={isIOS}
      />

      {/* STOP TRACKING MODAL */}
      {showStopModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in border border-gray-200 dark:border-gray-700">
            <div className="p-6 text-center">
              <div className="bg-amber-100 dark:bg-amber-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <StopCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Ruta Pausada</h3>
              <p className="text-gray-500 dark:text-blue-300 mb-6">
                Has recorrido <strong>{distanceTraveled.toFixed(2)} km</strong> en <strong>{formatTime(elapsedTime)}</strong>.<br />
                ¿Qué deseas hacer?
              </p>
              {!isSavingDetails ? (
                // STEP 1: OPTIONS
                <div className="flex flex-col gap-3">
                  <button onClick={handleContinue} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-agro-600 hover:bg-agro-700 text-white rounded-lg font-semibold transition-colors">
                    <Play className="w-5 h-5 fill-current" /> Continuar Tracking
                  </button>
                  <button onClick={() => setIsSavingDetails(true)} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
                    <Save className="w-5 h-5" /> Guardar Ruta
                  </button>
                  <button onClick={handleDiscard} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg font-semibold transition-colors">
                    <Trash2 className="w-5 h-5" /> Descartar
                  </button>
                </div>
              ) : (
                // STEP 2: DETAILS FORM
                <div className="animate-fade-in">
                  <div className="w-full mb-4 text-left">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej: Ruta Lote 5"
                      value={trackName}
                      onChange={(e) => setTrackName(e.target.value)}
                      className="w-full text-base p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white mb-3"
                      autoFocus
                    />
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Observaciones (Opcional)</label>
                    <textarea
                      placeholder="Escribe aquí si viste algo raro..."
                      value={trackNotes}
                      onChange={(e) => setTrackNotes(e.target.value)}
                      className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white resize-none h-20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setIsSavingDetails(false)} className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      Volver
                    </button>
                    <button onClick={handleSave} className="flex-[2] py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                      <Save className="w-5 h-5" /> Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
      }

      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm z-10 hidden md:flex">
        <div className="p-6 flex items-center space-x-2 border-b border-gray-100 dark:border-gray-700">
          <div className="bg-agro-600 dark:bg-agro-500 p-2 rounded-lg"><Sprout className="w-6 h-6 text-white" /></div>
          <div><h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight leading-none">Ing Marcon</h1><span className="text-[10px] text-gray-400 dark:text-blue-300 uppercase font-semibold">Consultoría</span></div>
        </div>
        {renderNavItems()}
      </aside>

      {
        isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)}></div>
            <aside className="relative w-72 bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col animate-slide-in-left">
              <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-2"><div className="bg-agro-600 dark:bg-agro-500 p-2 rounded-lg"><Sprout className="w-5 h-5 text-white" /></div><span className="font-bold text-gray-800 dark:text-white">Ing Marcon</span></div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X className="w-6 h-6" /></button>
              </div>
              {renderNavItems()}
              <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-4 px-2">
                  <div className="w-8 h-8 rounded-full bg-agro-100 dark:bg-agro-900/50 flex items-center justify-center text-agro-700 dark:text-agro-400 font-bold">{currentUser.name.charAt(0)}</div>
                  <div className="flex flex-col"><span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate w-32">{currentUser.name}</span><span className="text-[10px] text-gray-500 dark:text-blue-300 capitalize">{currentUser.role}</span></div>
                </div>
                <button onClick={logout} className="w-full flex items-center justify-center px-4 py-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"><LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión</button>

                {/* Mobile Install Button */}
                {!isStandalone && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center px-4 py-2 mt-2 bg-agro-600 text-white rounded-lg hover:bg-agro-700 transition-colors text-sm font-medium"
                  >
                    <Download className="w-4 h-4 mr-2" /> Instalar Aplicación
                  </button>
                )}
              </div>
            </aside>
          </div>
        )
      }

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 md:px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Menu className="w-6 h-6" /></button>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-blue-100 truncate">{headerTitle}</h2>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4 shrink-0">
            {/* TRACKING CONTROL */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <div className="flex items-center mr-2">
                {isTracking ? (
                  <button
                    onClick={handleStopClick}
                    className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors font-bold text-sm shadow-sm"
                  >
                    <StopCircle className="w-4 h-4 fill-current animate-pulse" />
                    <span>{(distanceTraveled).toFixed(2)} km</span>
                    <span className="mx-1 opacity-50">|</span>
                    <span className="font-mono">{formatTime(elapsedTime)}</span>
                    <span className="text-xs uppercase ml-1 bg-red-200 dark:bg-red-800 px-1.5 py-0.5 rounded text-red-800 dark:text-red-100">PARAR</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsTrackingModalOpen(true)}
                    className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Iniciar Ruta"
                  >
                    <Circle className="w-5 h-5" />
                    <span className="text-xs font-bold hidden sm:inline">GPS</span>
                  </button>
                )}
              </div>
            )}

            {/* Indicador de estado offline clickeable */}
            <div className="relative offline-dropdown-container">
              <button
                onClick={() => setShowOfflineDetails(!showOfflineDetails)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer hover:shadow-md ${isOnline
                  ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  : 'bg-orange-50/90 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                  }`}
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                ) : isOnline ? (
                  <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
                ) : (
                  <CloudOff className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                )}
                {pendingCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {!isOnline && pendingCount === 0 && (
                  <span className="text-xs font-medium text-gray-600 dark:text-blue-300">Modo offline</span>
                )}
              </button>

              {/* Dropdown de detalles */}
              {showOfflineDetails && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-4">
                  {/* Estado de conexión */}
                  <div className="flex items-center gap-2 mb-3">
                    {isOnline ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-blue-200">
                      {isOnline ? 'Conexión establecida' : 'Modo offline activo'}
                    </span>
                  </div>

                  {/* Información de sincronización */}
                  <div className="space-y-2 text-xs text-gray-600 dark:text-blue-300 mb-3">
                    <div className="flex justify-between">
                      <span>Operaciones pendientes:</span>
                      <span className="font-medium text-gray-800 dark:text-white">{pendingCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Última sincronización:</span>
                      <span className="font-medium text-gray-800 dark:text-white">{getLastSyncText()}</span>
                    </div>
                  </div>

                  {/* Botón de sincronización manual */}
                  {isOnline && pendingCount > 0 && !isSyncing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManualSync();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Sincronizar ahora
                    </button>
                  )}

                  {/* Mensaje informativo */}
                  {!isOnline && pendingCount > 0 && (
                    <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded text-xs text-orange-700 dark:text-orange-300">
                      Los datos se sincronizarán automáticamente cuando vuelva la conexión.
                    </div>
                  )}

                  {pendingCount === 0 && isOnline && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded text-xs text-green-700 dark:text-green-300">
                      ✓ Todos los datos están sincronizados
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            <div className="hidden md:flex items-center space-x-3 border-l pl-6 border-gray-200 dark:border-gray-700">
              <div className="flex flex-col items-end mr-1"><span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{currentUser.name}</span><span className="text-xs text-gray-500 dark:text-blue-300 capitalize">{currentUser.role}</span></div>

              {/* Desktop Install Button */}
              {!isStandalone && (
                <button
                  onClick={handleInstallClick}
                  className="p-2 text-agro-600 hover:bg-agro-50 dark:text-agro-400 dark:hover:bg-agro-900/20 rounded-lg transition-colors"
                  title="Instalar Aplicación"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}

              <button onClick={logout} className="p-2 text-gray-500 hover:text-red-500 dark:text-blue-300 transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8 relative">
          {children}
        </div>
      </main>
    </div >
  );
};