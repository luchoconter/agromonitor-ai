
import { collection, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MonitoringRecord, LotSummary } from '../../types/models';
import { uploadMedia, deleteMedia } from '../utils/mediaUtils';
import { enqueueOperation, MediaIds } from '../offlineQueueService';
import { saveBlobToIndexedDB } from '../indexedDBService';
import { addToLocalCache } from '../localCacheService';

export const addMonitoring = async (data: Partial<MonitoringRecord>, audioBlobUrl?: string) => {
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const baseFolder = `${data.companyId}/${data.fieldId}/${data.plotId}`;
    const fileName = `${dateStr}_${timeStr}_${Math.floor(Math.random() * 1000)}`;

    // Detectar modo offline ANTES de intentar Firebase
    const isOffline = !navigator.onLine;
    
    // Si offline, ir directamente al flujo de guardado local (sin try-catch)
    if (!isOffline) {
        // MODO ONLINE: intentar guardar en Firebase
        try {
        let audioUrl = null;
        if (audioBlobUrl) {
            audioUrl = await uploadMedia(audioBlobUrl, `monitoring-audios/${baseFolder}/${fileName}.webm`);
        }

        let photoUrl = data.media?.photoUrl;
        if (photoUrl && photoUrl.startsWith('blob:')) {
            photoUrl = await uploadMedia(photoUrl, `monitoring-photos/${baseFolder}/${fileName}.jpg`);
        }
        
        await addDoc(collection(db, 'monitorings'), {
            ...data,
            media: { ...data.media, audioUrl: audioUrl || data.media?.audioUrl || null, photoUrl: photoUrl || null },
            lastModified: Date.now(),
            createdAt: Date.now()
        });
        console.log('✅ Monitoreo guardado en Firebase');
        return; // Salir si Firebase exitoso
    } catch (error: any) {
        // Si falla Firebase, caer al flujo offline
        console.warn('📴 Error de Firebase, guardando localmente...');
    }
    }
    
    // MODO OFFLINE o error de Firebase: guardar archivos en IndexedDB y encolar
    console.warn('📴 Guardando en modo offline...');
    
    const mediaIds: MediaIds = {};
    let allMediaSavedSuccessfully = true;
    const errors: string[] = [];
    
    // Guardar foto en IndexedDB si existe como blob URL
    const originalPhotoUrl = data.media?.photoUrl;
        if (originalPhotoUrl && originalPhotoUrl.startsWith('blob:')) {
            try {
                mediaIds.photo = await saveBlobToIndexedDB(originalPhotoUrl, 'photo');
                console.log(`✅ Foto guardada en IndexedDB: ${mediaIds.photo}`);
            } catch (e: any) {
                console.error('❌ Error crítico guardando foto en IndexedDB:', e?.message || e);
                allMediaSavedSuccessfully = false;
                errors.push(`Foto: ${e?.message || 'Error desconocido'}`);
                
                // Si es error de quota, no continuar
                if (e?.message?.includes('QUOTA_EXCEEDED')) {
                    throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                }
            }
        }
        
        // Guardar audio en IndexedDB si existe
        if (audioBlobUrl) {
            try {
                mediaIds.audio = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                console.log(`✅ Audio guardado en IndexedDB: ${mediaIds.audio}`);
            } catch (e: any) {
                console.error('❌ Error crítico guardando audio en IndexedDB:', e?.message || e);
                allMediaSavedSuccessfully = false;
                errors.push(`Audio: ${e?.message || 'Error desconocido'}`);
                
                // Si es error de quota, no continuar
                if (e?.message?.includes('QUOTA_EXCEEDED')) {
                    throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                }
            }
        }
        
        // Verificar si había multimedia y falló guardar
        const hasMedia = originalPhotoUrl || audioBlobUrl;
        
        // Si tenía multimedia y no se guardó correctamente, LANZAR ERROR
        if (hasMedia && !allMediaSavedSuccessfully) {
            throw new Error(`Error guardando offline: ${errors.join(', ')}`);
        }
        
    // Solo encolar si todos los archivos multimedia se guardaron exitosamente
    // O si no había archivos multimedia
    if (allMediaSavedSuccessfully || !hasMedia) {
        const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docToCache = {
            ...data,
            media: { ...data.media, audioUrl: null, photoUrl: null },
            _offlineMedia: mediaIds, // Metadata para visualización offline
            _operationId: operationId,
            lastModified: Date.now(),
            createdAt: Date.now()
        };
        
        // Encolar para sincronización
        enqueueOperation('addMonitoring', docToCache, mediaIds);
        
        // Guardar en cache local para feedback inmediato
        addToLocalCache('monitorings', docToCache);
        
        console.log('✅ Monitoreo guardado localmente y encolado para sincronización');
    }
};

export const updateMonitoring = async (id: string, data: Partial<MonitoringRecord>, audioBlobUrl?: string) => {
     const dateStr = new Date().toISOString().split('T')[0];
     
     // Detectar modo offline ANTES de intentar Firebase
     const isOffline = !navigator.onLine;
     
     // Si offline, ir directamente al flujo de guardado local
     if (!isOffline) {
         // MODO ONLINE: intentar guardar en Firebase
         try {
         let audioUrl = data.media?.audioUrl;
         if (audioBlobUrl) {
             audioUrl = await uploadMedia(audioBlobUrl, `monitoring-audios/updates/${id}_${dateStr}.webm`);
         }
         
         let photoUrl = data.media?.photoUrl;
         if (photoUrl && photoUrl.startsWith('blob:')) {
             photoUrl = await uploadMedia(photoUrl, `monitoring-photos/updates/${id}_${dateStr}.jpg`);
         }
         
         await updateDoc(doc(db, 'monitorings', id), {
             ...data,
             media: { ...data.media, audioUrl: audioUrl || null, photoUrl: photoUrl || null },
             lastModified: Date.now()
         });
         console.log('✅ Monitoreo actualizado en Firebase');
         return; // Salir si Firebase exitoso
     } catch (error) {
         // Si falla Firebase, caer al flujo offline
         console.warn('📴 Error de Firebase, guardando localmente...');
     }
     }
     
     // MODO OFFLINE o error de Firebase: guardar archivos en IndexedDB y encolar
     console.warn('📴 Guardando actualización en modo offline...');
     
     const mediaIds: MediaIds = {};
     let allMediaSavedSuccessfully = true;
     const errors: string[] = [];
     
     // Guardar foto en IndexedDB si existe como blob URL
     const originalPhotoUrl = data.media?.photoUrl;
         if (originalPhotoUrl && originalPhotoUrl.startsWith('blob:')) {
             try {
                 mediaIds.photo = await saveBlobToIndexedDB(originalPhotoUrl, 'photo');
                 console.log(`✅ Foto guardada en IndexedDB: ${mediaIds.photo}`);
             } catch (e: any) {
                 console.error('❌ Error crítico guardando foto en IndexedDB:', e?.message || e);
                 allMediaSavedSuccessfully = false;
                 errors.push(`Foto: ${e?.message || 'Error desconocido'}`);
                 if (e?.message?.includes('QUOTA_EXCEEDED')) {
                     throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                 }
             }
         }
         
         // Guardar audio en IndexedDB si existe
         if (audioBlobUrl) {
             try {
                 mediaIds.audio = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                 console.log(`✅ Audio guardado en IndexedDB: ${mediaIds.audio}`);
             } catch (e: any) {
                 console.error('❌ Error crítico guardando audio en IndexedDB:', e?.message || e);
                 allMediaSavedSuccessfully = false;
                 errors.push(`Audio: ${e?.message || 'Error desconocido'}`);
                 if (e?.message?.includes('QUOTA_EXCEEDED')) {
                     throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                 }
             }
         }
         
         // Verificar si había multimedia y falló guardar
         const hasMedia = originalPhotoUrl || audioBlobUrl;
         
         // Si tenía multimedia y no se guardó correctamente, LANZAR ERROR
         if (hasMedia && !allMediaSavedSuccessfully) {
             throw new Error(`Error guardando offline: ${errors.join(', ')}`);
         }
         
     // Solo encolar si todos los archivos se guardaron exitosamente
     if (allMediaSavedSuccessfully || !hasMedia) {
         enqueueOperation('updateMonitoring', {
             id,
             ...data,
             media: { ...data.media, audioUrl: null, photoUrl: null },
             _offlineMedia: mediaIds // Metadata para visualización offline
         }, mediaIds);
         console.log('✅ Actualización guardada localmente y encolada para sincronización');
     }
};

export const deleteMonitoring = async (id: string) => { 
    const docRef = doc(db, 'monitorings', id);
    
    try {
        // 1. Read document to find associated media
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // 2. Delete media from storage (if exists)
            if (data.media?.photoUrl) await deleteMedia(data.media.photoUrl);
            if (data.media?.audioUrl) await deleteMedia(data.media.audioUrl);
        }

        // 3. Delete document
        await deleteDoc(docRef);
        console.log('✅ Monitoreo eliminado de Firebase');
    } catch (error) {
        console.warn('📴 Sin conexión, encolando eliminación...');
        enqueueOperation('deleteMonitoring', { id });
    }
};

export const addLotSummary = async (data: Partial<LotSummary>, audioBlobUrl?: string) => {
    console.log('🎤 addLotSummary recibió audioBlobUrl:', !!audioBlobUrl, audioBlobUrl ? audioBlobUrl.substring(0, 50) + '...' : 'null');
    
    // Si no hay audio, ir directo a la lógica offline si estamos offline
    if (!audioBlobUrl && !navigator.onLine) {
        console.log('📴 Sin audio y sin conexión, guardando directo offline...');
        const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docToCache = {
            ...data,
            audioUrl: null,
            isReviewed: false,
            _offlineMedia: {},
            _operationId: operationId,
            lastModified: Date.now(),
            createdAt: Date.now()
        };
        
        enqueueOperation('addLotSummary', docToCache, {});
        addToLocalCache('lotSummaries', docToCache);
        console.log('✅ Resumen de lote sin audio guardado offline');
        return;
    }
    
    try {
        let audioUrl = null;
        if (audioBlobUrl) {
            console.log('📤 Subiendo audio de resumen...');
            audioUrl = await uploadMedia(audioBlobUrl, `lot-summaries-audio/${data.plotId}/${Date.now()}.webm`);
            console.log('✅ Audio subido, URL:', audioUrl);
        } else {
            console.log('⚠️ No hay audio para subir (online)');
        }
        
        const docData = { 
            ...data, 
            audioUrl, 
            isReviewed: false,
            lastModified: Date.now(),
            createdAt: Date.now()
        };
        console.log('💾 Guardando documento con audioUrl:', !!audioUrl);
        
        // Timeout de 3 segundos para evitar que se cuelgue en offline
        const savePromise = addDoc(collection(db, 'lotSummaries'), docData);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Firestore no responde (3s)')), 3000)
        );
        
        await Promise.race([savePromise, timeoutPromise]);
        console.log('✅ Resumen de lote guardado en Firebase');
    } catch (error) {
        console.warn('📴 Sin conexión, guardando audio y encolando resumen de lote...');
        
        const mediaIds: MediaIds = {};
        let allMediaSavedSuccessfully = true;
        
        // Guardar audio en IndexedDB si existe
        if (audioBlobUrl) {
            try {
                mediaIds.audio = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                console.log(`✅ Audio de resumen guardado en IndexedDB: ${mediaIds.audio}`);
            } catch (e: any) {
                console.error('❌ Error crítico guardando audio de resumen en IndexedDB:', e?.message || e);
                allMediaSavedSuccessfully = false;
                if (e?.message?.includes('QUOTA_EXCEEDED')) {
                    throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                }
            }
        }
        
        // Solo encolar si el audio se guardó exitosamente (o no había audio)
        if (allMediaSavedSuccessfully || !audioBlobUrl) {
            const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const docToCache = {
                ...data,
                audioUrl: null,
                isReviewed: false,
                _offlineMedia: mediaIds, // Metadata para visualización offline
                _operationId: operationId,
                lastModified: Date.now(),
                createdAt: Date.now()
            };
            
            // Encolar para sincronización
            enqueueOperation('addLotSummary', docToCache, mediaIds);
            
            // Guardar en cache local para feedback inmediato
            addToLocalCache('lotSummaries', docToCache);
            
            console.log('✅ Resumen de lote encolado para sincronización posterior');
        } else {
            throw new Error('No se pudo guardar el audio. La operación no se encoló para evitar pérdida de datos.');
        }
    }
};

export const deleteLotSummary = async (id: string) => {
    const docRef = doc(db, 'lotSummaries', id);

    try {
        // 1. Read document to find associated media
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // 2. Delete media from storage
            if (data.audioUrl) await deleteMedia(data.audioUrl);
            if (data.engineerAudioUrl) await deleteMedia(data.engineerAudioUrl);
        }

        // 3. Delete document
        await deleteDoc(docRef);
        console.log('✅ Resumen de lote eliminado de Firebase');
    } catch (error) {
        console.warn('📴 Sin conexión, encolando eliminación de resumen...');
        enqueueOperation('deleteLotSummary', { id });
    }
};

export const toggleLotSummaryReview = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'lotSummaries', id), { isReviewed: !currentStatus });
};

export const updateLotSummaryFeedback = async (id: string, status: 'verde' | 'amarillo' | 'rojo', notes: string, audioBlobUrl?: string, audioDuration?: number) => {
    try {
        let audioUrl = undefined;
        if (audioBlobUrl) {
            audioUrl = await uploadMedia(audioBlobUrl, `lot-summaries-feedback/${id}/${Date.now()}.webm`);
        }
        
        const updateData: any = { 
            engineerStatus: status, 
            engineerNotes: notes, 
            isReviewed: true,
            lastModified: Date.now()
        };
        if (audioUrl) { 
            updateData.engineerAudioUrl = audioUrl; 
            updateData.engineerAudioDuration = audioDuration; 
        }
        
        await updateDoc(doc(db, 'lotSummaries', id), updateData);
        console.log('✅ Feedback de resumen actualizado en Firebase');
    } catch (error) {
        console.warn('📴 Sin conexión, guardando audio y encolando feedback...');
        
        const mediaIds: MediaIds = {};
        let allMediaSavedSuccessfully = true;
        
        // Guardar audio en IndexedDB si existe
        if (audioBlobUrl) {
            try {
                mediaIds.audio = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                console.log(`✅ Audio de feedback guardado en IndexedDB: ${mediaIds.audio}`);
            } catch (e: any) {
                console.error('❌ Error crítico guardando audio de feedback en IndexedDB:', e?.message || e);
                allMediaSavedSuccessfully = false;
                if (e?.message?.includes('QUOTA_EXCEEDED')) {
                    throw new Error('No hay suficiente espacio de almacenamiento. Por favor, sincroniza los datos pendientes o libera espacio.');
                }
            }
        }
        
        // Solo encolar si el audio se guardó exitosamente (o no había audio)
        if (allMediaSavedSuccessfully || !audioBlobUrl) {
            enqueueOperation('updateLotSummaryFeedback', { id, status, notes, audioDuration }, mediaIds);
            console.log('✅ Feedback encolado para sincronización posterior');
        } else {
            throw new Error('No se pudo guardar el audio de feedback. La operación no se encoló para evitar pérdida de datos.');
        }
    }
};
