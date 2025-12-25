// Servicio de sincronización automática
// Procesa la cola de operaciones pendientes cuando vuelve la conexión

import { getQueue, dequeueOperation, incrementRetries, updateSyncStatus } from './offlineQueueService';
import { collection, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getBlobFromIndexedDB, deleteBlobFromIndexedDB } from './indexedDBService';
import { uploadMedia } from './utils/mediaUtils';
import { removeFromLocalCache } from './localCacheService';

const MAX_RETRIES = 3;

// Procesar una operación de la cola
const processOperation = async (operation: any) => {
  const startTime = Date.now();
  console.log(`🔄 Procesando operación: ${operation.type} (ID: ${operation.id}, Intento: ${operation.retries + 1}/${MAX_RETRIES})`);
  
  try {
    // PASO 1: Recuperar y subir archivos multimedia desde IndexedDB
    let finalData = { ...operation.data };
    const mediaUploadResults = { photo: false, audio: false };
    
    if (operation.mediaIds) {
      // Subir foto si existe
      if (operation.mediaIds.photo) {
        try {
          const photoBlob = await getBlobFromIndexedDB(operation.mediaIds.photo);
          if (photoBlob) {
            const photoBlobUrl = URL.createObjectURL(photoBlob);
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            const baseFolder = `${finalData.companyId}/${finalData.fieldId}/${finalData.plotId}`;
            const fileName = `${dateStr}_${timeStr}_${Math.floor(Math.random() * 1000)}`;
            
            const photoUrl = await uploadMedia(photoBlobUrl, `monitoring-photos/${baseFolder}/${fileName}.jpg`);
            
            if (!finalData.media) finalData.media = {};
            finalData.media.photoUrl = photoUrl;
            
            // Limpiar blob URL temporal
            URL.revokeObjectURL(photoBlobUrl);
            
            // Eliminar de IndexedDB
            await deleteBlobFromIndexedDB(operation.mediaIds.photo);
            console.log(`✅ Foto subida desde IndexedDB: ${operation.mediaIds.photo} (${(photoBlob.size / 1024).toFixed(1)}KB)`);
            mediaUploadResults.photo = true;
          } else {
            console.warn(`⚠️ Foto no encontrada en IndexedDB: ${operation.mediaIds.photo}`);
          }
        } catch (error: any) {
          console.error(`❌ Error subiendo foto desde IndexedDB:`, {
            mediaId: operation.mediaIds.photo,
            error: error?.message || error,
            stack: error?.stack
          });
          // Continuar con la operación sin la foto
        }
      }
      
      // Subir audio si existe (solo para monitorings que usan media.audioUrl)
      // LotSummaries y Prescriptions tienen su propia lógica y usan audioUrl en la raíz
      if (operation.mediaIds.audio && operation.type === 'addMonitoring') {
        try {
          const audioBlob = await getBlobFromIndexedDB(operation.mediaIds.audio);
          if (audioBlob) {
            const audioBlobUrl = URL.createObjectURL(audioBlob);
            const dateStr = new Date().toISOString().split('T')[0];
            const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
            const baseFolder = `${finalData.companyId}/${finalData.fieldId}/${finalData.plotId}`;
            const fileName = `${dateStr}_${timeStr}_${Math.floor(Math.random() * 1000)}`;
            
            const audioUrl = await uploadMedia(audioBlobUrl, `monitoring-audios/${baseFolder}/${fileName}.webm`);
            
            if (!finalData.media) finalData.media = {};
            finalData.media.audioUrl = audioUrl;
            
            // Limpiar blob URL temporal
            URL.revokeObjectURL(audioBlobUrl);
            
            // Eliminar de IndexedDB
            await deleteBlobFromIndexedDB(operation.mediaIds.audio);
            console.log(`✅ Audio subido desde IndexedDB: ${operation.mediaIds.audio} (${(audioBlob.size / 1024).toFixed(1)}KB)`);
            mediaUploadResults.audio = true;
          } else {
            console.warn(`⚠️ Audio no encontrado en IndexedDB: ${operation.mediaIds.audio}`);
          }
        } catch (error: any) {
          console.error(`❌ Error subiendo audio desde IndexedDB:`, {
            mediaId: operation.mediaIds.audio,
            error: error?.message || error,
            stack: error?.stack
          });
          // Continuar con la operación sin el audio
        }
      }
    }
    
    // PASO 2: Ejecutar la operación con los datos finales
    switch (operation.type) {
      case 'addMonitoring':
        // Limpiar solo metadata offline (createdAt debe ir a Firebase)
        const { _offlineMedia, _operationId, ...cleanData } = finalData;
        await addDoc(collection(db, 'monitorings'), cleanData);
        
        // PASO 3: Limpiar del cache local (feedback ya no necesario)
        if (_operationId) {
          removeFromLocalCache('monitorings', _operationId);
        }
        break;
        
      case 'updateMonitoring':
        const { id: monId, _offlineMedia: _, ...monData } = finalData;
        await updateDoc(doc(db, 'monitorings', monId), monData);
        break;
        
      case 'deleteMonitoring':
        await deleteDoc(doc(db, 'monitorings', operation.data.id));
        break;
        
      case 'addLotSummary':
        // Limpiar solo metadata offline (createdAt debe ir a Firebase)
        const { _operationId: lotOpId, ...lotCleanData } = finalData;
        
        // Para lot summaries, manejar audio si existe
        if (operation.mediaIds?.audio) {
          try {
            const audioBlob = await getBlobFromIndexedDB(operation.mediaIds.audio);
            if (audioBlob) {
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              const audioUrl = await uploadMedia(audioBlobUrl, `lot-summaries-audio/${lotCleanData.plotId}/${Date.now()}.webm`);
              lotCleanData.audioUrl = audioUrl;
              URL.revokeObjectURL(audioBlobUrl);
              console.log(`✅ Audio de resumen subido desde IndexedDB`);
            }
          } catch (error) {
            console.error(`❌ Error subiendo audio de resumen:`, error);
          }
        }
        await addDoc(collection(db, 'lotSummaries'), lotCleanData);
        
        // Delay largo antes de limpiar para transición suave
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Limpiar del cache local
        if (lotOpId) {
          removeFromLocalCache('lotSummaries', lotOpId);
        }
        
        // Limpiar blob de IndexedDB después del delay largo
        if (operation.mediaIds?.audio) {
          try {
            await deleteBlobFromIndexedDB(operation.mediaIds.audio);
            console.log(`🧹 Blob de audio de resumen limpiado de IndexedDB después de 10s`);
          } catch (error) {
            console.warn(`⚠️ No se pudo limpiar blob de IndexedDB:`, error);
          }
        }
        break;
        
      case 'deleteLotSummary':
        await deleteDoc(doc(db, 'lotSummaries', operation.data.id));
        break;
        
      case 'updateLotSummaryFeedback':
        const { id: summaryId, status, notes, audioDuration } = finalData;
        const updateData: any = { engineerStatus: status, engineerNotes: notes, isReviewed: true };
        
        // Manejar audio de feedback si existe
        if (operation.mediaIds?.audio) {
          try {
            const audioBlob = await getBlobFromIndexedDB(operation.mediaIds.audio);
            if (audioBlob) {
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              const audioUrl = await uploadMedia(audioBlobUrl, `lot-summaries-feedback/${summaryId}/${Date.now()}.webm`);
              updateData.engineerAudioUrl = audioUrl;
              updateData.engineerAudioDuration = audioDuration;
              URL.revokeObjectURL(audioBlobUrl);
              console.log(`✅ Audio de feedback subido desde IndexedDB`);
            }
          } catch (error) {
            console.error(`❌ Error subiendo audio de feedback:`, error);
          }
        }
        
        await updateDoc(doc(db, 'lotSummaries', summaryId), updateData);
        
        // Delay largo antes de limpiar blob
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Limpiar blob de IndexedDB después del delay largo
        if (operation.mediaIds?.audio) {
          try {
            await deleteBlobFromIndexedDB(operation.mediaIds.audio);
            console.log(`🧹 Blob de feedback limpiado de IndexedDB después de 10s`);
          } catch (error) {
            console.warn(`⚠️ No se pudo limpiar blob de IndexedDB:`, error);
          }
        }
        break;
        
      case 'addPrescription':
        // Limpiar metadata offline antes de subir (solo _operationId y _offlineMedia)
        const { _operationId: prescOpId, _offlineMedia: prescMedia, ...prescCleanData } = finalData;
        
        // Manejar audio si existe
        if (operation.mediaIds?.audio) {
          try {
            const audioBlob = await getBlobFromIndexedDB(operation.mediaIds.audio);
            if (audioBlob) {
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              const audioUrl = await uploadMedia(audioBlobUrl, `prescriptions-audio/${prescCleanData.companyId}/${Date.now()}.webm`);
              prescCleanData.audioUrl = audioUrl;
              URL.revokeObjectURL(audioBlobUrl);
              console.log(`✅ Audio de receta subido desde IndexedDB`);
            }
          } catch (error) {
            console.error(`❌ Error subiendo audio de receta:`, error);
          }
        }
        
        await addDoc(collection(db, 'prescriptions'), prescCleanData);
        
        // PASO 3: Limpiar del cache local (IGUAL QUE MONITORINGS)
        if (prescOpId) {
          removeFromLocalCache('prescriptions', prescOpId);
        }
        
        // Limpiar blob de IndexedDB
        if (operation.mediaIds?.audio) {
          try {
            await deleteBlobFromIndexedDB(operation.mediaIds.audio);
            console.log(`🧹 Blob de audio limpiado de IndexedDB`);
          } catch (error) {
            console.warn(`⚠️ No se pudo limpiar blob de IndexedDB:`, error);
          }
        }
        break;
        
      case 'updatePrescription':
        const { id: prescId, _offlineMedia: prescUpMedia, ...prescUpdateData } = finalData;
        
        // Manejar audio si existe
        if (operation.mediaIds?.audio) {
          try {
            const audioBlob = await getBlobFromIndexedDB(operation.mediaIds.audio);
            if (audioBlob) {
              const audioBlobUrl = URL.createObjectURL(audioBlob);
              const audioUrl = await uploadMedia(audioBlobUrl, `prescriptions-audio/updates/${prescId}_${Date.now()}.webm`);
              prescUpdateData.audioUrl = audioUrl;
              URL.revokeObjectURL(audioBlobUrl);
              console.log(`✅ Audio de receta actualizado subido desde IndexedDB`);
            }
          } catch (error) {
            console.error(`❌ Error subiendo audio de receta actualizada:`, error);
          }
        }
        
        await updateDoc(doc(db, 'prescriptions', prescId), prescUpdateData);
        
        // Delay largo antes de limpiar blob - dar tiempo a que Firestore y red se estabilicen
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Limpiar blob de IndexedDB después del delay largo
        if (operation.mediaIds?.audio) {
          try {
            await deleteBlobFromIndexedDB(operation.mediaIds.audio);
            console.log(`🧹 Blob de audio actualizado limpiado de IndexedDB después de 10s`);
          } catch (error) {
            console.warn(`⚠️ No se pudo limpiar blob de IndexedDB:`, error);
          }
        }
        break;
        
      case 'deletePrescription':
        await deleteDoc(doc(db, 'prescriptions', operation.data.id));
        break;
        
      default:
        console.warn(`⚠️ Tipo de operación desconocido: ${operation.type}`);
    }
    
    // Operación exitosa - remover de la cola
    const duration = Date.now() - startTime;
    console.log(`✅ Operación completada exitosamente: ${operation.type} (ID: ${operation.id}, Duración: ${duration}ms, Media: foto=${mediaUploadResults.photo}, audio=${mediaUploadResults.audio})`);
    dequeueOperation(operation.id);
    return true;
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`❌ Error procesando operación ${operation.id}:`, {
      type: operation.type,
      retries: operation.retries,
      duration: `${duration}ms`,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
      data: operation.data ? {
        companyId: operation.data.companyId,
        fieldId: operation.data.fieldId,
        plotId: operation.data.plotId
      } : 'no data'
    });
    
    // Incrementar reintentos
    if (operation.retries < MAX_RETRIES) {
      incrementRetries(operation.id);
      return false;
    } else {
      // Máximo de reintentos alcanzado - remover de la cola
      console.error(`🚫 Operación ${operation.id} descartada después de ${MAX_RETRIES} reintentos`);
      dequeueOperation(operation.id);
      return false;
    }
  }
};

// Determinar prioridad de una operación (menor número = mayor prioridad)
const getOperationPriority = (type: string): number => {
  // Orden: add (1) → update (2) → delete (3)
  // Esto asegura que no se intenten actualizar registros que aún no existen
  if (type.startsWith('add')) return 1;
  if (type.startsWith('update')) return 2;
  if (type.startsWith('delete')) return 3;
  return 4; // Desconocidos al final
};

// Sincronizar todas las operaciones pendientes con orden inteligente
export const syncPendingOperations = async () => {
  const queue = getQueue();
  
  if (queue.length === 0) {
    console.log('✅ No hay operaciones pendientes para sincronizar');
    return;
  }
  
  console.log(`🔄 Iniciando sincronización de ${queue.length} operaciones pendientes...`);
  updateSyncStatus({ isSyncing: true });
  
  // Ordenar operaciones por prioridad y timestamp
  const sortedQueue = [...queue].sort((a, b) => {
    const priorityDiff = getOperationPriority(a.type) - getOperationPriority(b.type);
    if (priorityDiff !== 0) return priorityDiff;
    // Si tienen la misma prioridad, ordenar por timestamp (más antiguo primero)
    return a.timestamp - b.timestamp;
  });
  
  console.log(`📋 Orden de sincronización:`, sortedQueue.map(op => `${op.type} (${new Date(op.timestamp).toLocaleTimeString()})`));
  
  let successCount = 0;
  let failCount = 0;
  
  // Procesar operaciones secuencialmente en orden de prioridad
  for (const operation of sortedQueue) {
    const success = await processOperation(operation);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Pequeña pausa entre operaciones para no saturar el servidor
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  updateSyncStatus({ 
    isSyncing: false, 
    lastSync: Date.now() 
  });
  
  console.log(`✅ Sincronización completada: ${successCount} exitosas, ${failCount} fallidas`);
  
  return { successCount, failCount };
};

// Inicializar listener de conexión
export const initAutoSync = () => {
  // Listener para evento 'online'
  window.addEventListener('online', async () => {
    console.log('🌐 Conexión detectada, iniciando sincronización automática...');
    
    // Esperar 2 segundos para asegurar que la conexión esté estable
    setTimeout(async () => {
      try {
        await syncPendingOperations();
      } catch (error) {
        console.error('❌ Error en sincronización automática:', error);
      }
    }, 2000);
  });
  
  // Listener para evento 'offline'
  window.addEventListener('offline', () => {
    console.log('📴 Sin conexión - modo offline activado');
  });
  
  console.log('🔌 Auto-sincronización inicializada');
};
