// Servicio para persistir blobs en IndexedDB
// Solución al problema de blob URLs volátiles que se pierden al recargar la página

const DB_NAME = 'agro_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

interface MediaBlob {
  id: string;
  blob: Blob;
  type: 'photo' | 'audio';
  timestamp: number;
}

// Inicializar IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
};

// Verificar espacio disponible antes de guardar
const checkStorageQuota = async (blobSize: number): Promise<boolean> => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const available = (estimate.quota || 0) - (estimate.usage || 0);
      const requiredSpace = blobSize * 1.5; // 50% buffer de seguridad
      
      if (available < requiredSpace) {
        const availableMB = (available / 1024 / 1024).toFixed(2);
        const requiredMB = (requiredSpace / 1024 / 1024).toFixed(2);
        console.error(`⚠️ Espacio insuficiente: ${availableMB}MB disponibles, ${requiredMB}MB requeridos`);
        return false;
      }
      return true;
    }
    // Si no hay API de quota, asumir que hay espacio
    return true;
  } catch (error) {
    console.warn('No se pudo verificar quota de storage:', error);
    return true; // Continuar de todas formas
  }
};

// Guardar blob en IndexedDB con retry logic
export const saveBlobToIndexedDB = async (
  blobUrl: string, 
  type: 'photo' | 'audio',
  maxRetries: number = 3
): Promise<string> => {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = await initDB();
      
      // Convertir blob URL a blob real
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }
      const blob = await response.blob();
      
      // Verificar espacio disponible
      const hasSpace = await checkStorageQuota(blob.size);
      if (!hasSpace) {
        throw new Error('QUOTA_EXCEEDED: No hay suficiente espacio en IndexedDB');
      }
      
      // Generar ID único
      const id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const mediaBlob: MediaBlob = {
        id,
        blob,
        type,
        timestamp: Date.now()
      };

      return Promise.race<string>([
        new Promise<string>((resolve, reject) => {
          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.add(mediaBlob);

          request.onsuccess = () => {
            console.log(`💾 Blob guardado en IndexedDB: ${id} (${(blob.size / 1024).toFixed(1)}KB, intento ${attempt}/${maxRetries})`);
            resolve(id);
          };
          request.onerror = () => {
            const error = request.error;
            console.error(`❌ Error en transacción IndexedDB (intento ${attempt}/${maxRetries}):`, error);
            reject(error);
          };
          
          transaction.onerror = () => {
            console.error(`❌ Error en transacción (intento ${attempt}/${maxRetries}):`, transaction.error);
            reject(transaction.error);
          };
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: IndexedDB no responde (3s)')), 3000)
        )
      ]);
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ Intento ${attempt}/${maxRetries} falló guardando blob en IndexedDB:`, error?.message || error);
      
      // Si es error de quota, no reintentar
      if (error?.message?.includes('QUOTA_EXCEEDED') || error?.name === 'QuotaExceededError') {
        throw new Error(`QUOTA_EXCEEDED: No hay suficiente espacio. Libera espacio o sincroniza datos pendientes.`);
      }
      
      // Si no es el último intento, esperar antes de reintentar
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Backoff exponencial
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  console.error(`❌ FALLO CRÍTICO: No se pudo guardar blob después de ${maxRetries} intentos`, lastError);
  throw lastError || new Error('Failed to save blob to IndexedDB after multiple attempts');
};

// Recuperar blob de IndexedDB
export const getBlobFromIndexedDB = async (id: string): Promise<Blob | null> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as MediaBlob | undefined;
        if (result) {
          console.log(`📦 Blob recuperado de IndexedDB: ${id}`);
          resolve(result.blob);
        } else {
          console.warn(`⚠️ Blob no encontrado en IndexedDB: ${id}`);
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error recuperando blob de IndexedDB:', error);
    return null;
  }
};

// Eliminar blob de IndexedDB
export const deleteBlobFromIndexedDB = async (id: string): Promise<void> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`🗑️ Blob eliminado de IndexedDB: ${id}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error eliminando blob de IndexedDB:', error);
  }
};

// Limpiar blobs antiguos (más de 7 días)
export const cleanupOldBlobs = async (): Promise<void> => {
  try {
    const db = await initDB();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(sevenDaysAgo);
      const request = index.openCursor(range);

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          if (deletedCount > 0) {
            console.log(`🧹 ${deletedCount} blobs antiguos eliminados de IndexedDB`);
          }
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error limpiando blobs antiguos:', error);
  }
};

// Obtener tamaño total usado en IndexedDB
export const getIndexedDBSize = async (): Promise<number> => {
  try {
    const db = await initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const blobs = request.result as MediaBlob[];
        const totalSize = blobs.reduce((sum, item) => sum + item.blob.size, 0);
        console.log(`📊 Tamaño total en IndexedDB: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error calculando tamaño de IndexedDB:', error);
    return 0;
  }
};

// Verificar si IndexedDB está disponible
export const isIndexedDBAvailable = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
};

// Obtener información de uso de storage
export const getStorageInfo = async (): Promise<{
  used: number;
  quota: number;
  available: number;
  percentUsed: number;
}> => {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const available = quota - used;
      const percentUsed = quota > 0 ? (used / quota) * 100 : 0;
      
      return { used, quota, available, percentUsed };
    }
    return { used: 0, quota: 0, available: 0, percentUsed: 0 };
  } catch (error) {
    console.error('Error obteniendo info de storage:', error);
    return { used: 0, quota: 0, available: 0, percentUsed: 0 };
  }
};
