// Sistema de cola para operaciones offline
// Guarda operaciones pendientes en localStorage y las sincroniza cuando vuelve la conexión

const QUEUE_KEY = 'agro_offline_queue';
const SYNC_STATUS_KEY = 'agro_sync_status';

export interface MediaIds {
  photo?: string;  // ID del blob de foto en IndexedDB
  audio?: string;  // ID del blob de audio en IndexedDB
}

export interface QueuedOperation {
  id: string;
  type: 'addMonitoring' | 'updateMonitoring' | 'deleteMonitoring' | 'addLotSummary' | 'deleteLotSummary' | 'updateLotSummaryFeedback' | 'addPrescription' | 'updatePrescription' | 'deletePrescription';
  data: any;
  mediaIds?: MediaIds;  // IDs de archivos en IndexedDB
  timestamp: number;
  retries: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  pendingCount: number;
}

// Validar estructura de una operación
const isValidOperation = (op: any): op is QueuedOperation => {
  if (!op || typeof op !== 'object') return false;
  if (typeof op.id !== 'string') return false;
  if (typeof op.timestamp !== 'number') return false;
  if (typeof op.retries !== 'number') return false;
  if (!op.data) return false;
  
  const validTypes = ['addMonitoring', 'updateMonitoring', 'deleteMonitoring', 'addLotSummary', 'deleteLotSummary', 'updateLotSummaryFeedback', 'addPrescription', 'updatePrescription', 'deletePrescription'];
  if (!validTypes.includes(op.type)) return false;
  
  return true;
};

// Obtener cola actual con validación
export const getQueue = (): QueuedOperation[] => {
  try {
    const queue = localStorage.getItem(QUEUE_KEY);
    if (!queue) return [];
    
    const parsed = JSON.parse(queue);
    if (!Array.isArray(parsed)) {
      console.error('⚠️ Cola corrupta: no es un array. Reiniciando cola.');
      localStorage.removeItem(QUEUE_KEY);
      return [];
    }
    
    // Filtrar operaciones válidas y mover las inválidas a una cola de fallidos
    const validOps: QueuedOperation[] = [];
    const invalidOps: any[] = [];
    
    parsed.forEach(op => {
      if (isValidOperation(op)) {
        validOps.push(op);
      } else {
        invalidOps.push(op);
      }
    });
    
    // Si hay operaciones inválidas, logear y guardar en cola separada
    if (invalidOps.length > 0) {
      console.warn(`⚠️ ${invalidOps.length} operaciones inválidas encontradas en la cola:`, invalidOps);
      try {
        const failedQueue = localStorage.getItem('agro_offline_queue_failed');
        const existingFailed = failedQueue ? JSON.parse(failedQueue) : [];
        localStorage.setItem('agro_offline_queue_failed', JSON.stringify([...existingFailed, ...invalidOps]));
      } catch (e) {
        console.error('No se pudo guardar operaciones inválidas:', e);
      }
      
      // Guardar solo las operaciones válidas
      if (validOps.length !== parsed.length) {
        saveQueue(validOps);
      }
    }
    
    return validOps;
  } catch (e) {
    console.error('❌ Error crítico leyendo cola offline:', e);
    return [];
  }
};

// Guardar cola
const saveQueue = (queue: QueuedOperation[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    updateSyncStatus({ pendingCount: queue.length });
  } catch (e) {
    console.error('Error guardando cola offline:', e);
  }
};

// Agregar operación a la cola
export const enqueueOperation = (
  type: QueuedOperation['type'],
  data: any,
  mediaIds?: MediaIds
): string => {
  const queue = getQueue();
  const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const operation: QueuedOperation = {
    id,
    type,
    data,
    mediaIds,
    timestamp: Date.now(),
    retries: 0
  };
  
  queue.push(operation);
  saveQueue(queue);
  
  console.log(`📥 Operación encolada: ${type} (ID: ${id})`, mediaIds ? `con archivos: ${JSON.stringify(mediaIds)}` : '');
  return id;
};

// Remover operación de la cola
export const dequeueOperation = (id: string) => {
  const queue = getQueue();
  const filtered = queue.filter(op => op.id !== id);
  saveQueue(filtered);
  console.log(`✅ Operación completada: ${id}`);
};

// Incrementar reintentos
export const incrementRetries = (id: string) => {
  const queue = getQueue();
  const operation = queue.find(op => op.id === id);
  if (operation) {
    operation.retries++;
    saveQueue(queue);
  }
};

// Obtener estado de sincronización
export const getSyncStatus = (): SyncStatus => {
  try {
    const status = localStorage.getItem(SYNC_STATUS_KEY);
    return status ? JSON.parse(status) : { isSyncing: false, lastSync: null, pendingCount: 0 };
  } catch (e) {
    return { isSyncing: false, lastSync: null, pendingCount: 0 };
  }
};

// Actualizar estado de sincronización
export const updateSyncStatus = (updates: Partial<SyncStatus>) => {
  const current = getSyncStatus();
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error actualizando estado de sincronización:', e);
  }
};

// Limpiar cola (solo para emergencias)
export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
  updateSyncStatus({ pendingCount: 0 });
  console.log('🗑️ Cola offline limpiada');
};

// Obtener operaciones fallidas/corruptas
export const getFailedOperations = (): any[] => {
  try {
    const failedQueue = localStorage.getItem('agro_offline_queue_failed');
    return failedQueue ? JSON.parse(failedQueue) : [];
  } catch (e) {
    console.error('Error leyendo cola de fallidos:', e);
    return [];
  }
};

// Limpiar operaciones fallidas
export const clearFailedOperations = () => {
  localStorage.removeItem('agro_offline_queue_failed');
  console.log('🗑️ Cola de operaciones fallidas limpiada');
};

// Health check de la cola - útil para debugging
export const queueHealthCheck = (): {
  isHealthy: boolean;
  validCount: number;
  failedCount: number;
  oldestOperation: number | null;
  newestOperation: number | null;
} => {
  const queue = getQueue();
  const failed = getFailedOperations();
  
  const timestamps = queue.map(op => op.timestamp).filter(t => t);
  const oldestOperation = timestamps.length > 0 ? Math.min(...timestamps) : null;
  const newestOperation = timestamps.length > 0 ? Math.max(...timestamps) : null;
  
  return {
    isHealthy: failed.length === 0,
    validCount: queue.length,
    failedCount: failed.length,
    oldestOperation,
    newestOperation
  };
};
