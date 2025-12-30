export interface TrackPoint {
    lat: number;
    lng: number;
    timestamp: number;
    accuracy: number;
    speed: number | null;
    heading: number | null;
}

export interface TrackSession {
    id: string; // generated UUID
    userId: string;
    userName: string;
    startTime: string; // ISO String
    endTime?: string; // ISO String
    points: TrackPoint[];
    distance: number; // in kilometers
    status: 'recording' | 'completed' | 'synced'; // recording: in memory/local, completed: finished but not uploaded, synced: in firestore
    companyId?: string;
    fieldIds?: string[];
    synced?: boolean;
    name?: string;
    notes?: string;
}
