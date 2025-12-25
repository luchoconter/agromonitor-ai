
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// COMPANIES
export const addCompany = async (name: string, ownerId: string, ownerName?: string) => { await addDoc(collection(db, 'companies'), { name, ownerId, ownerName }); };
export const updateCompany = async (id: string, name: string) => { await updateDoc(doc(db, 'companies', id), { name }); };

// CASCADING DELETE FOR COMPANY
export const deleteCompany = async (id: string) => { 
    const batch = writeBatch(db);

    // 1. Reference to the Company
    const companyRef = doc(db, 'companies', id);
    batch.delete(companyRef);

    // 2. Find and delete all associated Fields
    const fieldsQuery = query(collection(db, 'fields'), where('companyId', '==', id));
    const fieldsSnapshot = await getDocs(fieldsQuery);
    fieldsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 3. Find and delete all associated Plots
    const plotsQuery = query(collection(db, 'plots'), where('companyId', '==', id));
    const plotsSnapshot = await getDocs(plotsQuery);
    plotsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // Execute atomic batch
    await batch.commit();
};

// FIELDS
export const addField = async (name: string, companyId: string, ownerId: string, ownerName?: string) => { await addDoc(collection(db, 'fields'), { name, companyId, ownerId, ownerName }); };
export const updateField = async (id: string, name: string) => { await updateDoc(doc(db, 'fields', id), { name }); };

// CASCADING DELETE FOR FIELD
export const deleteField = async (id: string) => { 
    const batch = writeBatch(db);

    // 1. Reference to the Field
    const fieldRef = doc(db, 'fields', id);
    batch.delete(fieldRef);

    // 2. Find and delete all associated Plots
    const plotsQuery = query(collection(db, 'plots'), where('fieldId', '==', id));
    const plotsSnapshot = await getDocs(plotsQuery);
    plotsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // Execute atomic batch
    await batch.commit();
};

// PLOTS
export const addPlot = async (name: string, fieldId: string, hectares: number, ownerId: string, ownerName?: string, companyId?: string) => { await addDoc(collection(db, 'plots'), { name, fieldId, hectares, ownerId, ownerName, companyId }); };
export const updatePlot = async (id: string, name: string, hectares: number, fieldId?: string, companyId?: string) => { 
    const data: any = { name, hectares };
    if (fieldId) data.fieldId = fieldId;
    if (companyId) data.companyId = companyId;
    await updateDoc(doc(db, 'plots', id), data); 
};
export const deletePlot = async (id: string) => { await deleteDoc(doc(db, 'plots', id)); };

// BATCH IMPORT
export const batchAddPlots = async (
    plots: { name: string; hectares: number }[],
    fieldId: string,
    companyId: string,
    ownerId: string,
    ownerName?: string
) => {
    const batch = writeBatch(db);
    const plotsRef = collection(db, 'plots');

    plots.forEach(plot => {
        const docRef = doc(plotsRef); // Auto-ID
        batch.set(docRef, {
            name: plot.name,
            hectares: plot.hectares,
            fieldId,
            companyId,
            ownerId,
            ownerName
        });
    });

    await batch.commit();
};
