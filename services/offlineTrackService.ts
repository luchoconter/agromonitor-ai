import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TrackSession } from '../types/tracking';

const DB_NAME = 'agro_tracks_db';
const DB_VERSION = 1;
const STORE_NAME = 'items';

interface TracksDB extends DBSchema {
    items: {
        key: string;
        value: TrackSession;
    };
}

let dbPromise: Promise<IDBPDatabase<TracksDB>>;

const initDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<TracksDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
