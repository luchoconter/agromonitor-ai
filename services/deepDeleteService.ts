
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc, DocumentReference } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from './firebase';

// --- HELPER: DELETE FILES FROM STORAGE ---
// Intenta borrar archivos, ignora errores si el archivo ya no existe.
const deleteStorageFiles = async (urls: (string | null | undefined)[]) => {
    const validUrls = urls.filter((url): url is string => !!url);
    if (validUrls.length === 0) return;

    const promises = validUrls.map(async (url) => {
        try {
            const fileRef = ref(storage, url);
            await deleteObject(fileRef);
        } catch (error: any) {
            if (error.code !== 'storage/object-not-found') {
                console.warn(`Error deleting file ${url}:`, error);
            }
        }
    });

    await Promise.allSettled(promises);
};

// --- HELPER: BATCH DELETE FIRESTORE DOCS ---
// Firestore limita los batches a 500 operaciones. Dividimos en chunks de 400 por seguridad.
const deleteDocsInBatches = async (docRefs: DocumentReference[]) => {
    if (docRefs.length === 0) return;

    const CHUNK_SIZE = 400;
    for (let i = 0; i < docRefs.length; i += CHUNK_SIZE) {
        const chunk = docRefs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }
};

// --- LEVEL 1: DELETE PLOT (Deep Clean) ---
export const deepDeletePlot = async (plotId: string) => {
    console.log(`[DeepDelete] Starting cleanup for Plot: ${plotId}`);

    // 1. Gather all related data
    const monitoringsQuery = query(collection(db, 'monitorings'), where('plotId', '==', plotId));
    const summariesQuery = query(collection(db, 'lotSummaries'), where('plotId', '==', plotId));
    const assignmentsQuery = query(collection(db, 'assignments'), where('plotId', '==', plotId));

    const [monSnap, sumSnap, assignSnap] = await Promise.all([
        getDocs(monitoringsQuery),
        getDocs(summariesQuery),
        getDocs(assignmentsQuery)
    ]);

    // 2. Collect Files to Delete (Storage)
    const filesToDelete: (string | null | undefined)[] = [];
    
    // Extract from Monitorings
    monSnap.docs.forEach(d => {
        const data = d.data();
        if (data.media?.photoUrl) filesToDelete.push(data.media.photoUrl);
        if (data.media?.audioUrl) filesToDelete.push(data.media.audioUrl);
    });

    // Extract from Summaries
    sumSnap.docs.forEach(d => {
        const data = d.data();
        if (data.audioUrl) filesToDelete.push(data.audioUrl);
        if (data.engineerAudioUrl) filesToDelete.push(data.engineerAudioUrl);
    });

    // 3. Execute Storage Cleanup
    if (filesToDelete.length > 0) {
        console.log(`[DeepDelete] Deleting ${filesToDelete.length} files from Storage...`);
        await deleteStorageFiles(filesToDelete);
    }

    // 4. Execute Firestore Cleanup (Batched)
    const allDocsToDelete = [
        ...monSnap.docs.map(d => d.ref),
        ...sumSnap.docs.map(d => d.ref),
        ...assignSnap.docs.map(d => d.ref)
    ];

    if (allDocsToDelete.length > 0) {
        console.log(`[DeepDelete] Deleting ${allDocsToDelete.length} documents from Firestore...`);
        await deleteDocsInBatches(allDocsToDelete);
    }

    // 5. Finally, delete the Plot itself
    await deleteDoc(doc(db, 'plots', plotId));
    console.log(`[DeepDelete] Plot ${plotId} deleted successfully.`);
};

// --- LEVEL 2: DELETE FIELD (Deep Clean) ---
export const deepDeleteField = async (fieldId: string) => {
    console.log(`[DeepDelete] Starting cleanup for Field: ${fieldId}`);

    // 1. Find all plots
    const plotsQuery = query(collection(db, 'plots'), where('fieldId', '==', fieldId));
    const plotsSnap = await getDocs(plotsQuery);

    // 2. Recursively delete each plot (Sequential to avoid network saturation)
    for (const plotDoc of plotsSnap.docs) {
        await deepDeletePlot(plotDoc.id);
    }

    // 3. Delete the Field itself
    await deleteDoc(doc(db, 'fields', fieldId));
    console.log(`[DeepDelete] Field ${fieldId} deleted successfully.`);
};

// --- LEVEL 3: DELETE COMPANY (Deep Clean) ---
export const deepDeleteCompany = async (companyId: string) => {
    console.log(`[DeepDelete] Starting cleanup for Company: ${companyId}`);

    // 1. Find all fields
    const fieldsQuery = query(collection(db, 'fields'), where('companyId', '==', companyId));
    const fieldsSnap = await getDocs(fieldsQuery);

    // 2. Recursively delete each field
    for (const fieldDoc of fieldsSnap.docs) {
        await deepDeleteField(fieldDoc.id);
    }

    // 3. Cleanup specific Company-level data (e.g., Prescriptions)
    // Prescriptions are usually tied to company. If company is gone, prescriptions should go too.
    const presQuery = query(collection(db, 'prescriptions'), where('companyId', '==', companyId));
    const presSnap = await getDocs(presQuery);
    
    // Collect prescription audio files
    const presFiles: string[] = [];
    presSnap.docs.forEach(d => {
        const data = d.data();
        if (data.audioUrl) presFiles.push(data.audioUrl);
    });
    
    await deleteStorageFiles(presFiles);
    await deleteDocsInBatches(presSnap.docs.map(d => d.ref));

    // 4. Delete the Company itself
    await deleteDoc(doc(db, 'companies', companyId));
    console.log(`[DeepDelete] Company ${companyId} deleted successfully.`);
};
