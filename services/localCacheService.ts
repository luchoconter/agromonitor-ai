/**
 * Local Cache Service
 * 
 * Almacena documentos pendientes de sincronización en localStorage
 * para proporcionar feedback inmediato al usuario en modo offline.
 * 
 * Los documentos se almacenan con un _operationId único que permite
 * eliminarlos después de la sincronización exitosa.
 */

const CACHE_KEY = 'agro_local_cache';

interface LocalCache {
  monitorings: any[];
  lotSummaries: any[];
  prescriptions: any[];
}

/**
 * Obtiene el cache completo desde localStorage
 */
const getCache = (): LocalCache => {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    return cache ? JSON.parse(cache) : { monitorings: [], lotSummaries: [], prescriptions: [] };
  } catch (error) {
    console.error('❌ Error al leer cache local:', error);
    return { monitorings: [], lotSummaries: [], prescriptions: [] };
  }
};

/**
 * Guarda el cache completo en localStorage
 */
const setCache = (cache: LocalCache): void => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('❌ Error al guardar cache local:', error);
  }
};

/**
 * Agrega un documento al cache local
 */
export const addToLocalCache = (collection: 'monitorings' | 'lotSummaries' | 'prescriptions', doc: any): void => {
  const cache = getCache();
  
  if (!cache[collection]) {
    cache[collection] = [];
  }
  
  // Agregar el documento sin modificar (ya viene con createdAt desde el repository)
  cache[collection].push(doc);
  
  setCache(cache);
  console.log(`📦 Documento agregado al cache local (${collection}):`, doc._operationId);
  
  // Disparar evento para notificar a DataContext
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('localCacheUpdated', { detail: { collection } }));
  }
};

/**
 * Obtiene todos los documentos de una colección desde el cache local
 */
export const getFromLocalCache = (collection: 'monitorings' | 'lotSummaries' | 'prescriptions'): any[] => {
  const cache = getCache();
  return cache[collection] || [];
};

/**
 * Elimina un documento específico del cache local usando su operationId
 */
export const removeFromLocalCache = (collection: 'monitorings' | 'lotSummaries' | 'prescriptions', operationId: string): void => {
  const cache = getCache();
  
  if (cache[collection]) {
    const initialLength = cache[collection].length;
    cache[collection] = cache[collection].filter(
      (doc: any) => doc._operationId !== operationId
    );
    
    const removed = initialLength - cache[collection].length;
    if (removed > 0) {
      setCache(cache);
      console.log(`🗑️ Documento eliminado del cache local (${collection}):`, operationId);
      
      // Disparar evento para notificar a DataContext
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('localCacheUpdated', { detail: { collection } }));
      }
    }
  }
};

/**
 * Limpia todo el cache local (útil para debugging o reset)
 */
export const clearLocalCache = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    console.log('🧹 Cache local limpiado completamente');
  } catch (error) {
    console.error('❌ Error al limpiar cache local:', error);
  }
};

/**
 * Obtiene estadísticas del cache para debugging
 */
export const getCacheStats = () => {
  const cache = getCache();
  return {
    monitorings: cache.monitorings?.length || 0,
    totalSize: new Blob([JSON.stringify(cache)]).size
  };
};
