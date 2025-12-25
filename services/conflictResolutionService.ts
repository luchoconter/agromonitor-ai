// Servicio de detección y resolución de conflictos
// Detecta cuando múltiples usuarios modifican los mismos datos offline

interface ConflictInfo {
  operationId: string;
  type: string;
  documentId: string;
  localTimestamp: number;
  remoteTimestamp?: number;
  reason: string;
}

const CONFLICTS_KEY = 'agro_sync_conflicts';

// Guardar un conflicto detectado
export const recordConflict = (conflict: ConflictInfo): void => {
  try {
    const existing = getConflicts();
    existing.push({
      ...conflict,
      detectedAt: Date.now()
    });
    localStorage.setItem(CONFLICTS_KEY, JSON.stringify(existing));
    console.warn('⚠️ Conflicto detectado y registrado:', conflict);
  } catch (error) {
    console.error('Error registrando conflicto:', error);
  }
};

// Obtener todos los conflictos
export const getConflicts = (): any[] => {
  try {
    const conflicts = localStorage.getItem(CONFLICTS_KEY);
    return conflicts ? JSON.parse(conflicts) : [];
  } catch (error) {
    console.error('Error leyendo conflictos:', error);
    return [];
  }
};

// Limpiar conflictos resueltos
export const clearConflicts = (): void => {
  try {
    localStorage.removeItem(CONFLICTS_KEY);
    console.log('🗑️ Conflictos limpiados');
  } catch (error) {
    console.error('Error limpiando conflictos:', error);
  }
};

// Verificar si un documento tiene marca de tiempo más reciente en el servidor
export const checkForConflict = async (
  documentId: string,
  localTimestamp: number,
  getRemoteDoc: () => Promise<any>
): Promise<{ hasConflict: boolean; remoteTimestamp?: number }> => {
  try {
    const remoteDoc = await getRemoteDoc();
    
    if (!remoteDoc) {
      return { hasConflict: false };
    }

    const remoteTimestamp = remoteDoc.lastModified || remoteDoc.timestamp || 0;
    
    // Si el documento remoto es más reciente que el local, hay conflicto
    if (remoteTimestamp > localTimestamp) {
      console.warn(`⚠️ Conflicto potencial: Documento ${documentId} modificado remotamente`);
      return { hasConflict: true, remoteTimestamp };
    }

    return { hasConflict: false, remoteTimestamp };
  } catch (error) {
    console.error('Error verificando conflicto:', error);
    return { hasConflict: false };
  }
};

// Estrategia simple: "Last Write Wins" pero con notificación
export const resolveConflictStrategy = (
  strategy: 'local-wins' | 'remote-wins' | 'merge'
): 'local' | 'remote' | 'merge' => {
  // Por ahora, siempre usar "last write wins" (el que sincroniza después gana)
  // En el futuro, esto podría expandirse a permitir al usuario elegir
  return 'local'; // Por defecto, continuar con la operación local
};

// Agregar timestamp de última modificación a los datos
export const addModificationTimestamp = (data: any): any => {
  return {
    ...data,
    lastModified: Date.now(),
    modifiedBy: data.userId || data.ownerId || 'unknown'
  };
};

// Obtener estadísticas de conflictos
export const getConflictStats = (): {
  total: number;
  byType: Record<string, number>;
  oldest: number | null;
  newest: number | null;
} => {
  const conflicts = getConflicts();
  
  const byType: Record<string, number> = {};
  let oldest: number | null = null;
  let newest: number | null = null;

  conflicts.forEach((conflict: any) => {
    // Contar por tipo
    byType[conflict.type] = (byType[conflict.type] || 0) + 1;
    
    // Encontrar más antiguo y más nuevo
    const timestamp = conflict.detectedAt || conflict.localTimestamp;
    if (!oldest || timestamp < oldest) oldest = timestamp;
    if (!newest || timestamp > newest) newest = timestamp;
  });

  return {
    total: conflicts.length,
    byType,
    oldest,
    newest
  };
};
