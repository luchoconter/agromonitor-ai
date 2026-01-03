import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TrackSession } from '../types/tracking';

const DB_NAME = 'agro_tracks_db';
const DB_VERSION = 2; // Bump version
const STORE_NAME = 'items';
const ACTIVE_STORE_NAME = 'active_session';

interface TracksDB extends DBSchema {
    items: {
        key: string;
        value: TrackSession;
    };
    active_session: {
        key: string;
        value: TrackSession;
    };
}

let dbPromise: Promise<IDBPDatabase<TracksDB>>;

const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<TracksDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(ACTIVE_STORE_NAME)) {
                    db.createObjectStore(ACTIVE_STORE_NAME, { keyPath: 'id' });
                }
            },
        });
    }
    return dbPromise;
};

export const saveTrackOffline = async (track: TrackSession): Promise<void> => {
    try {
        const db = await initDB();
        await db.put(STORE_NAME, track);
        console.log(`[OfflineTrackService] Track ${track.id} saved offline.`);
    } catch (error) {
        console.error('[OfflineTrackService] Error saving track offline:', error);
        throw error;
    }
};

export const getPendingTracks = async (): Promise<TrackSession[]> => {
    try {
        const db = await initDB();
        const allTracks = await db.getAll(STORE_NAME);
        return allTracks.filter(t => !t.synced);
    } catch (error) {
        console.error('[OfflineTrackService] Error getting pending tracks:', error);
        return [];
    }
};

export const markTrackSynced = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        const track = await db.get(STORE_NAME, id);
        if (track) {
            track.synced = true;
            track.status = 'synced';
            await db.put(STORE_NAME, track);
            console.log(`[OfflineTrackService] Track ${id} marked as synced.`);
        }
    } catch (error) {
        console.error('[OfflineTrackService] Error marking track as synced:', error);
    }
}

export const deleteTrackOffline = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        await db.delete(STORE_NAME, id);
        console.log(`[OfflineTrackService] Track ${id} deleted offline.`);
    } catch (error) {
        console.error('[OfflineTrackService] Error deleting track offline:', error);
    }
}

// --- ACTIVE TRACK METHODS ---

export const saveActiveTrack = async (track: TrackSession): Promise<void> => {
    try {
        const db = await initDB();
        // overwrite any existing active track, we assume only one active at a time
        // We use the track.id as key, but we can also just clear before putting if we want to be strict.
        // For simplicity, just put it.
        await db.put(ACTIVE_STORE_NAME, track);
        // console.log(`[OfflineTrackService] Active track saved.`); // Log less to avoid spam
    } catch (error) {
        console.error('[OfflineTrackService] Error saving active track:', error);
    }
};

export const getActiveTrack = async (): Promise<TrackSession | undefined> => {
    try {
        const db = await initDB();
        const tracks = await db.getAll(ACTIVE_STORE_NAME);
        if (tracks.length > 0) {
            // If multiple found (shouldn't happen), return the latest one? or just the first.
            return tracks[0];
        }
        return undefined;
    } catch (error) {
        console.error('[OfflineTrackService] Error getting active track:', error);
        return undefined;
    }
};

export const deleteActiveTrack = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        await db.delete(ACTIVE_STORE_NAME, id);
        console.log(`[OfflineTrackService] Active track ${id} cleared.`);
    } catch (error) {
        console.error('[OfflineTrackService] Error deleting active track:', error);
    }
};
