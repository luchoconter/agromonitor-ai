// Servicio de optimización de cache para localStorage
// Implementa compresión y estrategias de expiración

const CACHE_KEY = 'agro_data_cache';
const CACHE_METADATA_KEY = 'agro_data_cache_meta';
const CACHE_EXPIRATION_DAYS = 7; // Cache expira después de 7 días

interface CacheMetadata {
  savedAt: number;
  expiresAt: number;
  version: string;
  dataSize: number;
  compressed: boolean;
}

// Simple compresión usando LZString-style algorithm (lightweight)
const compressString = (str: string): string => {
  try {
    // Usar compresión nativa del navegador si está disponible
    if (typeof CompressionStream !== 'undefined') {
      // CompressionStream no es síncrono, así que usamos una alternativa simple
      return str; // Por ahora, sin comprimir (para mantener sincronía)
    }
    return str;
  } catch (error) {
    console.warn('Compresión no disponible, guardando sin comprimir:', error);
    return str;
  }
};

const decompressString = (str: string): string => {
  try {
    return str; // Matching compressString behavior
  } catch (error) {
    console.warn('Error en descompresión:', error);
    return str;
  }
};

// Guardar datos en cache con metadata
export const saveCachedData = (data: any): boolean => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = compressString(jsonString);
    
    const metadata: CacheMetadata = {
      savedAt: Date.now(),
      expiresAt: Date.now() + (CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
      version: '1.0',
      dataSize: compressed.length,
      compressed: false // Por ahora sin comprimir
    };

    localStorage.setItem(CACHE_KEY, compressed);
    localStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
    
    const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
    console.log(`💾 Cache guardado: ${sizeMB}MB, expira en ${CACHE_EXPIRATION_DAYS} días`);
    
    return true;
  } catch (error: any) {
    console.error('❌ Error guardando cache:', error?.message || error);
    
    // Si es error de quota, intentar limpiar cache viejo
    if (error?.name === 'QuotaExceededError') {
      console.warn('⚠️ Quota excedida, limpiando cache...');
      clearCachedData();
      
      // Intentar guardar solo datos esenciales (sin historial completo)
      try {
        const essentialData = getEssentialData(data);
        const essentialJson = JSON.stringify(essentialData);
        localStorage.setItem(CACHE_KEY, essentialJson);
        console.log('💾 Cache esencial guardado (sin historial completo)');
        return true;
      } catch (e) {
        console.error('❌ No se pudo guardar ni cache esencial:', e);
        return false;
      }
    }
    
    return false;
  }
};

// Extraer solo datos esenciales (sin todo el historial)
const getEssentialData = (data: any): any => {
  return {
    companies: data.companies || [],
    fields: data.fields || [],
    plots: data.plots || [],
    seasons: data.seasons || [],
    pests: data.pests || [],
    crops: data.crops || [],
    agrochemicals: data.agrochemicals || [],
    tasks: data.tasks || [],
    prescriptions: data.prescriptions || [],
    templates: data.templates || [],
    assignments: data.assignments || [],
    // Limitar monitoreos a los últimos 50
    monitorings: (data.monitorings || []).slice(-50),
    // Limitar lot summaries a los últimos 20
    lotSummaries: (data.lotSummaries || []).slice(-20)
  };
};

// Cargar datos desde cache
export const loadCachedData = (): any | null => {
  try {
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    const cachedStr = localStorage.getItem(CACHE_KEY);
    
    if (!metadataStr || !cachedStr) {
      console.log('📦 No hay cache disponible');
      return null;
    }

    const metadata: CacheMetadata = JSON.parse(metadataStr);
    
    // Verificar si el cache expiró
    if (Date.now() > metadata.expiresAt) {
      console.warn('⚠️ Cache expirado, limpiando...');
      clearCachedData();
      return null;
    }

    const decompressed = decompressString(cachedStr);
    const data = JSON.parse(decompressed);
    
    const ageHours = Math.floor((Date.now() - metadata.savedAt) / (1000 * 60 * 60));
    const sizeMB = (metadata.dataSize / 1024 / 1024).toFixed(2);
    console.log(`📦 Cache cargado: ${sizeMB}MB, antigüedad: ${ageHours}h`);
    
    return data;
  } catch (error) {
    console.error('❌ Error cargando cache:', error);
    clearCachedData();
    return null;
  }
};

// Verificar si el cache es válido
export const isCacheValid = (): boolean => {
  try {
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    if (!metadataStr) return false;

    const metadata: CacheMetadata = JSON.parse(metadataStr);
    return Date.now() < metadata.expiresAt;
  } catch (error) {
    return false;
  }
};

// Obtener información del cache
export const getCacheInfo = (): {
  exists: boolean;
  valid: boolean;
  ageHours: number;
  sizeMB: number;
  expiresInDays: number;
} => {
  try {
    const metadataStr = localStorage.getItem(CACHE_METADATA_KEY);
    const cachedStr = localStorage.getItem(CACHE_KEY);
    
    if (!metadataStr || !cachedStr) {
      return { exists: false, valid: false, ageHours: 0, sizeMB: 0, expiresInDays: 0 };
    }

    const metadata: CacheMetadata = JSON.parse(metadataStr);
    const ageMs = Date.now() - metadata.savedAt;
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const sizeMB = metadata.dataSize / 1024 / 1024;
    const expiresInMs = metadata.expiresAt - Date.now();
    const expiresInDays = Math.max(0, Math.floor(expiresInMs / (1000 * 60 * 60 * 24)));
    const valid = Date.now() < metadata.expiresAt;

    return { exists: true, valid, ageHours, sizeMB, expiresInDays };
  } catch (error) {
    return { exists: false, valid: false, ageHours: 0, sizeMB: 0, expiresInDays: 0 };
  }
};

// Limpiar cache
export const clearCachedData = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_METADATA_KEY);
    console.log('🗑️ Cache limpiado');
  } catch (error) {
    console.error('Error limpiando cache:', error);
  }
};

// Invalidar cache forzadamente (útil después de cambios importantes)
export const invalidateCache = (): void => {
  clearCachedData();
  console.log('🔄 Cache invalidado');
};
