import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getSyncStatus, getQueue } from '../services/offlineQueueService';
import { syncPendingOperations } from '../services/autoSyncService';

export const OfflineStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Actualizar estado cada 2 segundos
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

  // Si no hay nada pendiente y estamos online, no mostrar nada (o mostrar versión mínima)
  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Badge principal */}
      <div 
        className={`
          rounded-lg shadow-lg border backdrop-blur-sm cursor-pointer
          transition-all duration-300
          ${isOnline ? 'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700' : 'bg-orange-50/90 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'}
          ${showDetails ? 'rounded-b-none' : ''}
        `}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="px-4 py-2 flex items-center gap-3">
          {/* Icono de estado */}
          {isSyncing ? (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          ) : isOnline ? (
            <Cloud className="w-5 h-5 text-green-500" />
          ) : (
            <CloudOff className="w-5 h-5 text-orange-500" />
          )}

          {/* Texto de estado */}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-800 dark:text-white">
              {isSyncing ? 'Sincronizando...' : isOnline ? 'En línea' : 'Sin conexión'}
            </span>
            {pendingCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {pendingCount} operación{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Badge de contador */}
          {pendingCount > 0 && (
            <div className="ml-2 px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
              {pendingCount}
            </div>
          )}
        </div>

        {/* Barra de progreso si está sincronizando */}
        {isSyncing && (
          <div className="h-1 bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }}></div>
          </div>
        )}
      </div>

      {/* Panel de detalles expandible */}
      {showDetails && (
        <div className="bg-white dark:bg-gray-800 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg shadow-lg p-4 min-w-[280px]">
          {/* Estado de conexión */}
          <div className="flex items-center gap-2 mb-3">
            {isOnline ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-orange-500" />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isOnline ? 'Conexión establecida' : 'Modo offline activo'}
            </span>
          </div>

          {/* Información de sincronización */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
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
  );
};
