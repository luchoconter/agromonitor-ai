// Hook personalizado para acceder al estado de sincronización offline
import { useState, useEffect } from 'react';
import { getSyncStatus, getQueue, queueHealthCheck } from '../services/offlineQueueService';
import type { QueuedOperation, SyncStatus } from '../services/offlineQueueService';

interface OfflineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync: number | null;
  queue: QueuedOperation[];
  healthCheck: ReturnType<typeof queueHealthCheck>;
}

export const useOfflineStatus = (updateIntervalMs: number = 2000): OfflineStatus => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => getSyncStatus());
  const [queue, setQueue] = useState<QueuedOperation[]>(() => getQueue());
  const [healthCheck, setHealthCheck] = useState(() => queueHealthCheck());

  useEffect(() => {
    // Función para actualizar todo el estado
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
      setSyncStatus(getSyncStatus());
      setQueue(getQueue());
      setHealthCheck(queueHealthCheck());
    };

    // Actualizar al montar
    updateStatus();

    // Event listeners para cambios de conexión
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

    // Polling periódico para actualizar el estado
    const interval = setInterval(updateStatus, updateIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [updateIntervalMs]);

  return {
    isOnline,
    isSyncing: syncStatus.isSyncing,
    pendingCount: syncStatus.pendingCount,
    lastSync: syncStatus.lastSync,
    queue,
    healthCheck
  };
};
