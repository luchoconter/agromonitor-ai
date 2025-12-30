import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    getDoc,
    deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase'; // Adjust path if needed, assuming firebase config is here
import { TrackSession } from '../../types/tracking';

const TRACKS_COLLECTION = 'tracks';

export const saveTrack = async (track: TrackSession): Promise<string> => {
    // We store minimal data, but points might be large. Firestore document limit is 1MB.
    // If points are too many, we might need subcollections, but for daily tracks it should be fine.
    // We'll rename 'id' to not conflict if we generated one locally, or use it.

    const { id, ...trackData } = track;

    const docRef = await addDoc(collection(db, TRACKS_COLLECTION), {
        ...trackData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });

    return docRef.id;
};

export const getTracks = async (companyId?: string, userId?: string, dateFrom?: Date, dateTo?: Date): Promise<TrackSession[]> => {
    let q = query(collection(db, TRACKS_COLLECTION), orderBy('startTime', 'desc'));

    if (userId) {
        q = query(q, where('userId', '==', userId));
    }

    // Note: composite indexes might be needed for complex queries

    const snapshot = await getDocs(q);
    const tracks: TrackSession[] = snapshot.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            userId: data.userId,
            userName: data.userName,
            startTime: data.startTime,
            endTime: data.endTime,
            points: data.points,
            distance: data.distance,
            status: data.status,
            name: data.name,
            notes: data.notes,
            companyId: data.companyId,
            fieldIds: data.fieldIds
        } as TrackSession;
    });

    // Client side filtering for dates/company if logic is complex or indexes missing
    return tracks.filter(t => {
        const date = new Date(t.startTime);
        if (dateFrom && date < dateFrom) return false;
        if (dateTo && date > dateTo) return false;
        if (companyId && t.companyId !== companyId) return false;
        return true;
    });
};

export const deleteTrack = async (trackId: string): Promise<void> => {
    await deleteDoc(doc(db, TRACKS_COLLECTION, trackId));
};
