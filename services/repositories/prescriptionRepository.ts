
import { collection, addDoc, updateDoc, doc, deleteDoc, getDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Prescription, PrescriptionTemplate, PrescriptionExecution } from '../../types/models';
import { uploadMedia, deleteMedia } from '../utils/mediaUtils';
import { enqueueOperation } from '../offlineQueueService';
import { addToLocalCache, removeFromLocalCache } from '../localCacheService';
import { saveBlobToIndexedDB } from '../indexedDBService';

// Helper to remove undefined fields which Firestore does not support
const cleanUndefined = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        }
    });
    return newObj;
};

// PRESCRIPTIONS
export const addPrescription = async (data: Omit<Prescription, 'id'>, audioBlobUrl?: string) => {
    // PASO 0: Detectar modo offline ANTES de cualquier operación
    const isOffline = !navigator.onLine;

    if (isOffline) {
        console.log('📴 Modo offline detectado - encolando receta');
        // FLUJO OFFLINE
        const operationId = `presc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        let audioIndexedDBId;

        // Guardar audio en IndexedDB si existe
        if (audioBlobUrl) {
            try {
                audioIndexedDBId = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                console.log('🎙️ Audio de receta guardado en IndexedDB:', audioIndexedDBId);
            } catch (error) {
                console.error('❌ Error guardando audio en IndexedDB:', error);
            }
        }

        // Crear documento con metadata completa (IGUAL que monitorings)
        const docToCache = {
            ...data,
            _operationId: operationId,
            _offlineMedia: audioIndexedDBId ? { audio: audioIndexedDBId } : undefined,
            createdAt: Date.now(), // Timestamp numérico (igual que monitorings)
            audioUrl: null // Se subirá después
        };

        // Encolar operación para sincronización posterior (con documento completo)
        enqueueOperation(
            'addPrescription',
            docToCache,
            audioIndexedDBId ? { audio: audioIndexedDBId } : undefined
        );

        // Agregar a cache local para feedback inmediato
        addToLocalCache('prescriptions', docToCache);

        // Pequeño delay para asegurar que el evento localCacheUpdated se procese
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('✅ Receta encolada para sincronización');
        return; // EXIT - No intentar Firebase
    }

    // FLUJO ONLINE (EXISTENTE - NO MODIFICADO)
    let audioUrl = undefined;
    if (audioBlobUrl) {
        try {
            // Agregar timeout de 5s para detectar problemas de red rápidamente
            const uploadPromise = uploadMedia(audioBlobUrl, `prescriptions-audio/${data.companyId}/${Date.now()}.webm`);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Upload timeout')), 5000)
            );
            audioUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (e) {
            console.warn("Audio upload failed for prescription", e);
            // Continuar sin audio
        }
    }

    const payload = cleanUndefined({ ...data, audioUrl: audioUrl || null });
    await addDoc(collection(db, 'prescriptions'), payload);
};

export const updatePrescription = async (id: string, data: Partial<Prescription>, audioBlobUrl?: string) => {
    // PASO 0: Detectar modo offline
    const isOffline = !navigator.onLine;

    if (isOffline) {
        console.log('📴 Modo offline detectado - encolando actualización de receta');
        // FLUJO OFFLINE
        let audioIndexedDBId;

        // Guardar nuevo audio en IndexedDB si existe
        if (audioBlobUrl) {
            try {
                audioIndexedDBId = await saveBlobToIndexedDB(audioBlobUrl, 'audio');
                console.log('🎙️ Audio actualizado guardado en IndexedDB:', audioIndexedDBId);
            } catch (error) {
                console.error('❌ Error guardando audio en IndexedDB:', error);
            }
        }

        // Encolar operación
        enqueueOperation(
            'updatePrescription',
            { id, ...data },
            audioIndexedDBId ? { audio: audioIndexedDBId } : undefined
        );

        // Actualizar cache local (buscar y reemplazar)
        // Nota: El cache local se limpiará automáticamente al sincronizar

        // Pequeño delay para asegurar que el evento se procese
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('✅ Actualización de receta encolada');
        return; // EXIT
    }

    // FLUJO ONLINE (EXISTENTE - NO MODIFICADO)
    let audioUrl = data.audioUrl;

    // Si hay un nuevo audio grabado, subirlo y reemplazar el anterior
    if (audioBlobUrl) {
        try {
            // Agregar timeout de 5s
            const uploadPromise = uploadMedia(audioBlobUrl, `prescriptions-audio/updates/${id}_${Date.now()}.webm`);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Upload timeout')), 5000)
            );
            audioUrl = await Promise.race([uploadPromise, timeoutPromise]);
        } catch (e) {
            console.warn("Audio update failed", e);
        }
    }

    const payload = cleanUndefined({ ...data, audioUrl: audioUrl || null });
    await updateDoc(doc(db, 'prescriptions', id), payload);
};

// NEW: Add Plots to existing Prescription
export const addPlotsToPrescription = async (
    prescriptionId: string,
    newPlotIds: string[],
    newPlotNames: string[]
) => {
    const docRef = doc(db, 'prescriptions', prescriptionId);
    await updateDoc(docRef, {
        plotIds: arrayUnion(...newPlotIds),
        plotNames: arrayUnion(...newPlotNames)
    });
};

// NEW: SPLIT PRESCRIPTION (Bifurcación)
// Esta función maneja la lógica de dividir una receta parcialmente ejecutada en dos.
export const splitPrescription = async (
    originalId: string,
    originalPrescription: Prescription,
    newData: Omit<Prescription, 'id'>,
    pendingPlotIds: string[],
    audioBlobUrl?: string
) => {
    const batch = writeBatch(db);

    // 1. Calcular lotes que se quedan en la receta original (los ya ejecutados)
    // Filtramos los plotIds originales, quitando los que se mueven a la nueva receta
    const executedPlotIds = originalPrescription.plotIds.filter(pid => !pendingPlotIds.includes(pid));
    const executedPlotNames = originalPrescription.plotNames.filter((_, idx) => {
        const pid = originalPrescription.plotIds[idx];
        return !pendingPlotIds.includes(pid);
    });

    // 2. Actualizar Receta Original (Se queda solo con lo ejecutado y se archiva o mantiene activa según lógica)
    const originalRef = doc(db, 'prescriptions', originalId);
    batch.update(originalRef, {
        plotIds: executedPlotIds,
        plotNames: executedPlotNames,
        // Opcional: Podríamos marcarla como 'archived' si se desea cerrar, 
        // pero mejor dejarla 'active' por si hay que corregir algo de lo ejecutado.
        notes: originalPrescription.notes + " (Receta dividida por edición posterior)"
    });

    // 3. Preparar Audio para la Nueva Receta
    let newAudioUrl = originalPrescription.audioUrl; // Hereda el audio original por defecto
    if (audioBlobUrl) {
        // Si el usuario grabó uno nuevo, lo subimos
        try {
            newAudioUrl = await uploadMedia(audioBlobUrl, `prescriptions-audio/${newData.companyId}/${Date.now()}.webm`);
        } catch (e) {
            console.warn("Audio upload failed for split prescription", e);
        }
    }

    // 4. Crear Nueva Receta (Con los cambios y solo para lotes pendientes)
    // Limpiamos executionData para la nueva receta (empieza de cero)
    const newPrescriptionRef = doc(collection(db, 'prescriptions'));
    const newPayload = cleanUndefined({
        ...newData,
        plotIds: pendingPlotIds,
        // plotNames ya viene actualizado en newData desde el frontend
        executionData: {}, // Reset execution history
        audioUrl: newAudioUrl || null
    });

    batch.set(newPrescriptionRef, newPayload);

    // 5. Ejecutar transacción
    await batch.commit();
};

// NEW: Update execution status for a specific plot inside a prescription
export const updatePrescriptionExecution = async (
    prescriptionId: string,
    plotId: string,
    executed: boolean,
    observation: string,
    userName: string
) => {
    const docRef = doc(db, 'prescriptions', prescriptionId);

    // Firestore allows updating nested fields in a map using dot notation
    // Key: executionData.{plotId}
    const updatePayload = {
        [`executionData.${plotId}`]: {
            executed,
            executedAt: new Date().toISOString(),
            executedBy: userName,
            observation
        }
    };

    await updateDoc(docRef, updatePayload);
};

export const deletePrescription = async (id: string) => {
    // PASO 0: Detectar modo offline
    const isOffline = !navigator.onLine;

    if (isOffline) {
        console.log('📴 Modo offline detectado - encolando eliminación de receta');
        // FLUJO OFFLINE
        enqueueOperation('deletePrescription', { id });

        // Remover del cache local
        removeFromLocalCache('prescriptions', id);

        // Pequeño delay para asegurar que el evento se procese
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('✅ Eliminación de receta encolada');
        return; // EXIT
    }

    // FLUJO ONLINE (EXISTENTE - NO MODIFICADO)
    const docRef = doc(db, 'prescriptions', id);

    // 1. Read document to find associated media
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        // 2. Delete media from storage
        if (data.audioUrl) await deleteMedia(data.audioUrl);
    }

    // 3. Delete document
    await deleteDoc(docRef);
};

// TEMPLATES
export const addPrescriptionTemplate = async (data: Omit<PrescriptionTemplate, 'id'>) => {
    await addDoc(collection(db, 'prescriptionTemplates'), data);
};

export const deletePrescriptionTemplate = async (id: string): Promise<void> => {
    const docRef = doc(db, 'prescriptionTemplates', id);
    await deleteDoc(docRef);
};

export const markPrescriptionExecuted = async (
    prescriptionId: string,
    plotId: string,
    executionData: PrescriptionExecution,
    audioBlobUrl?: string
): Promise<void> => {
    try {
        const docRef = doc(db, 'prescriptions', prescriptionId);

        // Upload audio if present
        if (audioBlobUrl) {
            const path = `prescriptions/${prescriptionId}/execution_${plotId}_${Date.now()}.webm`;
            const url = await uploadMedia(audioBlobUrl, path);
            executionData.audioUrl = url;
        }

        // Update using dot notation for nested map
        await updateDoc(docRef, {
            [`executionData.${plotId}`]: cleanUndefined(executionData)
        });
    } catch (error) {
        console.error("Error marking prescription executed:", error);
        throw error;
    }
};

// ASSIGNMENTS
// ASSIGNMENTS
export const savePlotAssignment = async (
    assignmentId: string | undefined,
    plotId: string,
    seasonId: string,
    cropId: string,
    ownerId: string,
    originalStand?: number,
    ownerName?: string
) => {
    const historyEntry = {
        date: new Date().toISOString(),
        cropId,
        originalStand: originalStand,
        userId: ownerId,
        userName: ownerName,
        action: assignmentId ? 'updated' : 'created'
    };

    if (assignmentId) {
        // Si hay ID, actualizamos
        const updateData: any = {
            cropId,
            history: arrayUnion(historyEntry)
        };
        if (originalStand !== undefined) updateData.originalStand = originalStand;

        await updateDoc(doc(db, 'assignments', assignmentId), updateData);
    } else {
        // Si no hay ID, creamos
        const newData: any = {
            plotId,
            seasonId,
            cropId,
            ownerId,
            ownerName,
            history: [historyEntry] // Inicializar historia
        };
        if (originalStand !== undefined) newData.originalStand = originalStand;

        await addDoc(collection(db, 'assignments'), newData);
    }
};