// Servicio de diagnóstico del sistema offline
// Proporciona información completa sobre el estado del sistema

import { queueHealthCheck, getSyncStatus } from './offlineQueueService';
import { getStorageInfo, getIndexedDBSize } from './indexedDBService';
import { getCacheInfo } from './cacheService';
import { getConflictStats } from './conflictResolutionService';

export interface SystemDiagnostics {
  timestamp: number;
  connection: {
    isOnline: boolean;
    type?: string;
  };
  sync: {
    isSyncing: boolean;
    pendingCount: number;
    lastSync: number | null;
    healthCheck: ReturnType<typeof queueHealthCheck>;
  };
  storage: {
    quota: {
      used: number;
      quota: number;
      available: number;
      percentUsed: number;
    };
    indexedDB: {
      sizeMB: number;
    };
    cache: {
      exists: boolean;
      valid: boolean;
      ageHours: number;
      sizeMB: number;
      expiresInDays: number;
    };
  };
  conflicts: {
    total: number;
    byType: Record<string, number>;
    oldest: number | null;
    newest: number | null;
  };
  warnings: string[];
  recommendations: string[];
}

// Obtener diagnóstico completo del sistema
export const getSystemDiagnostics = async (): Promise<SystemDiagnostics> => {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // 1. Estado de conexión
  const connection = {
    isOnline: navigator.onLine,
    type: (navigator as any).connection?.effectiveType || 'unknown'
  };

  // 2. Estado de sincronización
  const syncStatus = getSyncStatus();
  const healthCheck = queueHealthCheck();
  const sync = {
    isSyncing: syncStatus.isSyncing,
    pendingCount: syncStatus.pendingCount,
    lastSync: syncStatus.lastSync,
    healthCheck
  };

  // Warnings de sincronización
  if (healthCheck.failedCount > 0) {
    warnings.push(`${healthCheck.failedCount} operaciones fallidas en la cola`);
    recommendations.push('Revisa las operaciones fallidas con getFailedOperations()');
  }

  if (healthCheck.validCount > 50) {
    warnings.push(`Muchas operaciones pendientes (${healthCheck.validCount})`);
    recommendations.push('Sincroniza lo antes posible para evitar pérdida de datos');
  }

  if (healthCheck.oldestOperation) {
    const ageHours = (Date.now() - healthCheck.oldestOperation) / (1000 * 60 * 60);
    if (ageHours > 24) {
      warnings.push(`Operaciones pendientes de hace ${Math.floor(ageHours)}h`);
      recommendations.push('Operaciones muy antiguas pueden estar obsoletas');
    }
  }

  // 3. Estado de almacenamiento
  const quotaInfo = await getStorageInfo();
  const indexedDBSize = await getIndexedDBSize();
  const cacheInfo = getCacheInfo();

  const storage = {
    quota: quotaInfo,
    indexedDB: {
      sizeMB: indexedDBSize / 1024 / 1024
    },
    cache: cacheInfo
  };

  // Warnings de almacenamiento
  if (quotaInfo.percentUsed > 80) {
    warnings.push(`Almacenamiento casi lleno (${quotaInfo.percentUsed.toFixed(1)}%)`);
    recommendations.push('Sincroniza datos pendientes para liberar espacio');
  }

  if (quotaInfo.percentUsed > 90) {
    warnings.push('⚠️ CRÍTICO: Almacenamiento muy lleno, riesgo de pérdida de datos');
    recommendations.push('Sincroniza URGENTEMENTE y elimina datos antiguos');
  }

  if (storage.indexedDB.sizeMB > 50) {
    warnings.push(`IndexedDB grande (${storage.indexedDB.sizeMB.toFixed(1)}MB)`);
    recommendations.push('Considera sincronizar archivos multimedia');
  }

  if (!cacheInfo.valid && cacheInfo.exists) {
    warnings.push('Cache expirado');
    recommendations.push('El cache se renovará en la próxima sincronización');
  }

  // 4. Estado de conflictos
  const conflicts = getConflictStats();

  if (conflicts.total > 0) {
    warnings.push(`${conflicts.total} conflictos detectados`);
    recommendations.push('Revisa los conflictos con getConflicts()');
  }

  return {
    timestamp: Date.now(),
    connection,
    sync,
    storage,
    conflicts,
    warnings,
    recommendations
  };
};

// Generar reporte legible para consola
export const printDiagnosticReport = async (): Promise<void> => {
  const diagnostics = await getSystemDiagnostics();

  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 DIAGNÓSTICO DEL SISTEMA OFFLINE');
  console.log('═══════════════════════════════════════════════\n');

  console.log('🌐 CONEXIÓN:');
  console.log(`   Estado: ${diagnostics.connection.isOnline ? '✅ Online' : '❌ Offline'}`);
  console.log(`   Tipo: ${diagnostics.connection.type}\n`);

  console.log('🔄 SINCRONIZACIÓN:');
  console.log(`   Estado: ${diagnostics.sync.isSyncing ? '⏳ Sincronizando...' : '⏸️ Inactivo'}`);
  console.log(`   Pendientes: ${diagnostics.sync.pendingCount} operaciones`);
  console.log(`   Última sync: ${diagnostics.sync.lastSync ? new Date(diagnostics.sync.lastSync).toLocaleString() : 'Nunca'}`);
  console.log(`   Health: ${diagnostics.sync.healthCheck.isHealthy ? '✅ Saludable' : '⚠️ Problemas detectados'}`);
  console.log(`   Válidas: ${diagnostics.sync.healthCheck.validCount}, Fallidas: ${diagnostics.sync.healthCheck.failedCount}\n`);

  console.log('💾 ALMACENAMIENTO:');
  console.log(`   Uso: ${(diagnostics.storage.quota.used / 1024 / 1024).toFixed(2)}MB / ${(diagnostics.storage.quota.quota / 1024 / 1024).toFixed(2)}MB (${diagnostics.storage.quota.percentUsed.toFixed(1)}%)`);
  console.log(`   Disponible: ${(diagnostics.storage.quota.available / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   IndexedDB: ${diagnostics.storage.indexedDB.sizeMB.toFixed(2)}MB`);
  console.log(`   Cache: ${diagnostics.storage.cache.exists ? `${diagnostics.storage.cache.sizeMB.toFixed(2)}MB (válido: ${diagnostics.storage.cache.valid})` : 'No existe'}\n`);

  console.log('⚔️ CONFLICTOS:');
  console.log(`   Total: ${diagnostics.conflicts.total}`);
  if (diagnostics.conflicts.total > 0) {
    console.log('   Por tipo:', diagnostics.conflicts.byType);
  }
  console.log('');

  if (diagnostics.warnings.length > 0) {
    console.log('⚠️ ADVERTENCIAS:');
    diagnostics.warnings.forEach(w => console.log(`   • ${w}`));
    console.log('');
  }

  if (diagnostics.recommendations.length > 0) {
    console.log('💡 RECOMENDACIONES:');
    diagnostics.recommendations.forEach(r => console.log(`   • ${r}`));
    console.log('');
  }

  if (diagnostics.warnings.length === 0 && diagnostics.recommendations.length === 0) {
    console.log('✅ SISTEMA EN ÓPTIMAS CONDICIONES\n');
  }

  console.log('═══════════════════════════════════════════════\n');
};

// Exportar función global para usar en consola del navegador
if (typeof window !== 'undefined') {
  (window as any).agroSystemDiagnostics = printDiagnosticReport;
  console.log('💡 Tip: Ejecuta agroSystemDiagnostics() en la consola para ver el estado del sistema');
}
