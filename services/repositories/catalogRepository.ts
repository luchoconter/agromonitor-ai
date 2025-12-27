
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadMedia, deleteMedia } from '../utils/mediaUtils';

// SEASONS
export const addSeason = async (name: string, ownerId: string, ownerName?: string) => { await addDoc(collection(db, 'seasons'), { name, isActive: false, ownerId, ownerName }); };
export const updateSeason = async (id: string, name: string) => { await updateDoc(doc(db, 'seasons', id), { name }); };
export const deleteSeason = async (id: string) => { await deleteDoc(doc(db, 'seasons', id)); };
export const setActiveSeason = async (seasonId: string, ownerId: string) => {
    const q = query(collection(db, 'seasons'), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
        const isTarget = doc.id === seasonId;
        batch.update(doc.ref, { isActive: isTarget });
    });

    await batch.commit();
};

// PESTS
export const addPest = async (name: string, ownerId: string, ownerName?: string, extraData?: any) => {
    let imageUrl = extraData?.imageUrl;

    // Upload image if it's a local blob
    if (imageUrl && imageUrl.startsWith('blob:')) {
        try {
            const fileName = `pest_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
            imageUrl = await uploadMedia(imageUrl, `catalog-pests/${ownerId}/${fileName}`);
        } catch (e) {
            console.warn("Pest image upload failed", e);
            imageUrl = null;
        }
    }

    await addDoc(collection(db, 'pests'), {
        name,
        ownerId,
        ownerName,
        ...extraData,
        imageUrl: imageUrl || null
    });
};

export const updatePest = async (id: string, name: string, extraData?: any) => {
    let imageUrl = extraData?.imageUrl;

    // Upload image if it's a NEW local blob
    if (imageUrl && imageUrl.startsWith('blob:')) {
        try {
            const fileName = `pest_${id}_${Date.now()}.jpg`;
            imageUrl = await uploadMedia(imageUrl, `catalog-pests/updates/${fileName}`);
        } catch (e) {
            console.warn("Pest image update failed", e);
            imageUrl = null;
        }
    }

    const updatePayload = { name, ...extraData };
    if (imageUrl !== undefined) {
        updatePayload.imageUrl = imageUrl;
    }

    await updateDoc(doc(db, 'pests', id), updatePayload);
};

export const deletePest = async (id: string) => {
    const docRef = doc(db, 'pests', id);

    // Clean up storage image
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.imageUrl) {
            try { await deleteMedia(data.imageUrl); } catch (e) { console.warn('Image cleanup failed', e); }
        }
    }

    await deleteDoc(docRef);
};

// CROPS
export const addCrop = async (name: string, ownerId: string, ownerName?: string) => { await addDoc(collection(db, 'crops'), { name, ownerId, ownerName }); };
export const updateCrop = async (id: string, name: string) => { await updateDoc(doc(db, 'crops', id), { name }); };
export const deleteCrop = async (id: string) => { await deleteDoc(doc(db, 'crops', id)); };

// AGROCHEMICALS
export const addAgrochemical = async (name: string, ownerId: string, ownerName?: string, extraData?: any) => { await addDoc(collection(db, 'agrochemicals'), { name, ownerId, ownerName, ...extraData }); };
export const updateAgrochemical = async (id: string, name: string, extraData?: any) => { await updateDoc(doc(db, 'agrochemicals', id), { name, ...extraData }); };
export const deleteAgrochemical = async (id: string) => { await deleteDoc(doc(db, 'agrochemicals', id)); };

// TASKS
export const addTask = async (name: string, ownerId: string, ownerName?: string, pricePerHectare?: number) => { await addDoc(collection(db, 'tasks'), { name, ownerId, ownerName, pricePerHectare: pricePerHectare || 0 }); };
export const updateTask = async (id: string, name: string, pricePerHectare?: number) => { await updateDoc(doc(db, 'tasks', id), { name, pricePerHectare: pricePerHectare || 0 }); };
export const deleteTask = async (id: string) => { await deleteDoc(doc(db, 'tasks', id)); };