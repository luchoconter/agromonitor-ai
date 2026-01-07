import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { TrackSession, TrackPoint } from '../types/tracking';
import { calculateDistance, requestWakeLock, releaseWakeLock } from '../services/trackingService';
import { saveTrack } from '../services/repositories/trackRepository';
import { enqueueOperation } from '../services/offlineQueueService';
import { useAuth } from './AuthContext'; // Assuming this exists, verify later
// Simple UUID generator to avoid dependency issues
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

interface TrackingContextType {
    isTracking: boolean;
    isPaused: boolean;
    currentTrack: TrackSession | null;
    elapsedTime: number; // in seconds
    startTracking: (companyId?: string, fieldIds?: string[]) => Promise<void>;
    pauseTracking: () => Promise<void>;
    resumeTracking: () => Promise<void>;
    finishTracking: (save: boolean, name?: string, notes?: string) => Promise<void>;
    distanceTraveled: number;
    error: string | null;
}

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export const TrackingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useAuth();
    const [isTracking, setIsTracking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<TrackSession | null>(null);
    const [distanceTraveled, setDistanceTraveled] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const watchIdRef = useRef<number | null>(null);
    const lastPointRef = useRef<TrackPoint | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Timer Logic: Use Date.now() delta to calculate elapsed time accurately
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;

        if (isTracking && !isPaused && currentTrack?.startTime) {
            const start = new Date(currentTrack.startTime).getTime();

            // Immediate update
            setElapsedTime(Math.floor((Date.now() - start) / 1000));

            intervalId = setInterval(() => {
                const now = Date.now();
                setElapsedTime(Math.floor((now - start) / 1000));
            }, 1000);
        } else if (!isTracking) {
            // Reset if not tracking
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isTracking, isPaused, currentTrack?.startTime]);

    // --- RESTORE ACTIVE TRACK ON MOUNT ---
    useEffect(() => {
        const restoreSession = async () => {
            if (!currentUser) return;
            try {
                const { getActiveTrack } = await import('../services/offlineTrackService');
                const savedTrack = await getActiveTrack();
                if (savedTrack && savedTrack.status === 'recording') {
                    console.log("Found interrupted active track, restoring...");
                    setCurrentTrack(savedTrack);
                    setIsTracking(true);

                    // Recalculate duration approx
                    const start = new Date(savedTrack.startTime).getTime();
                    const now = new Date().getTime();
                    // We can't know exact 'moved' time vs 'paused' time if app died, 
                    // but we can set it to (now - start) / 1000 or keep stored if we stored it (we didn't store elapsed).
                    // Best effort: set to (now - start) / 1000 to show "Total Duration"
                    setElapsedTime(Math.floor((now - start) / 1000));
                    setDistanceTraveled(savedTrack.distance || 0);

                    if (savedTrack.points.length > 0) {
                        lastPointRef.current = savedTrack.points[savedTrack.points.length - 1];
                    }

                    // Auto-resume GPS if it was recording
                    setIsPaused(false);
                    startGpsWatch();
                }
            } catch (e) {
                console.error("Error restoring track session", e);
            }
        };
        restoreSession();
    }, [currentUser]);

    // --- WAKELOCK & VISIBILITY HANDLER ---
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && isTracking && !isPaused) {
                console.log("App foregrounded, ensuring WakeLock and GPS...");
                await requestWakeLock();

                // If the app was backgrounded for a long time, the watch might have been killed.
                // We re-affirm the watch.
                if (watchIdRef.current === null) {
                    console.log("WatchID lost, restarting GPS...");
                    startGpsWatch();
                } else {
                    // Force a single update to check if still alive
                    navigator.geolocation.getCurrentPosition(
                        (pos) => console.log("GPS Alive check:", pos.coords.latitude),
                        () => {
                            console.warn("GPS appears dead, restarting...");
                            startGpsWatch();
                        },
                        { timeout: 5000, maximumAge: 0 }
                    );
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isTracking, isPaused]);


    const startTracking = async (companyId?: string, fieldIds?: string[]) => {
        if (!currentUser) return;

        // Security Check: Only admins and operators can track
        if (currentUser.role !== 'admin' && currentUser.role !== 'operator') {
            setError("No tienes permisos para iniciar un recorrido.");
            return;
        }

        if (!navigator.geolocation) {
            setError("Geolocalización no soportada.");
            return;
        }

        setError(null);
        setDistanceTraveled(0);
        setElapsedTime(0);
        setIsPaused(false);
        lastPointRef.current = null;

        const newTrack: TrackSession = {
            id: generateUUID(),
            userId: currentUser.id,
            userName: currentUser.name,
            startTime: new Date().toISOString(),
            points: [],
            distance: 0,
            status: 'recording',
            companyId,
            fieldIds,
            synced: false
        };

        setCurrentTrack(newTrack);
        setIsTracking(true);

        // Save immediately as active
        try {
            const { saveActiveTrack } = await import('../services/offlineTrackService');
            await saveActiveTrack(newTrack);
        } catch (e) { console.error("Could not save initial active track", e); }

        // Start GPS
        await startGpsWatch();
    };

    const startGpsWatch = async () => {
        const ok = await requestWakeLock();
        if (!ok) console.warn("No se pudo activar WakeLock");

        // Clear existing if any to avoid dupes
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            async (position) => {
                const { latitude, longitude, accuracy, speed, heading } = position.coords;
                const timestamp = position.timestamp;

                // Improved Filter: accuracy must be better than 40m (was 50)
                if (accuracy > 40) return;

                const newPoint: TrackPoint = {
                    lat: latitude,
                    lng: longitude,
                    timestamp,
                    accuracy,
                    speed,
                    heading
                };

                // OPTIMIZATION: Smart Distance Filter
                // Dist min: 7 meters (was 10m). Better resolution for walking.
                let shouldSave = false;
                let dist = 0;

                if (!lastPointRef.current) {
                    shouldSave = true;
                } else {
                    dist = calculateDistance(
                        lastPointRef.current.lat,
                        lastPointRef.current.lng,
                        latitude,
                        longitude
                    );
                    if (dist > 0.007) { // 7 meters min
                        shouldSave = true;
                    }
                }

                if (shouldSave) {
                    let updatedTrack: TrackSession | null = null;

                    setCurrentTrack(prev => {
                        if (!prev) return null;
                        const newPoints = [...prev.points, newPoint];
                        const newDist = (prev.distance || 0) + dist;
                        updatedTrack = {
                            ...prev,
                            points: newPoints,
                            distance: newDist
                        };
                        return updatedTrack;
                    });

                    if (lastPointRef.current) {
                        setDistanceTraveled(prev => prev + dist);
                    }
                    lastPointRef.current = newPoint;

                    // PERSIST ACTIVE TRACK CONTINUOUSLY
                    if (updatedTrack) {
                        const { saveActiveTrack } = await import('../services/offlineTrackService');
                        saveActiveTrack(updatedTrack as TrackSession).catch(err => console.error("Error saving active track update", err));
                    }
                }
            },
            (err) => {
                console.error(err);
                // Don't kill tracking on minor timeout errors, just log
                if (err.code === 1) { // Permission denied
                    setError("Permiso de ubicación denegado.");
                    setIsTracking(false);
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 20000, // relaxed timeout
                maximumAge: 0
            }
        );
    };

    const stopGpsWatch = async () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        await releaseWakeLock();
    };

    const pauseTracking = async () => {
        await stopGpsWatch();
        setIsPaused(true);
        // We could also update status in DB to 'paused' if we wanted
    };

    const resumeTracking = async () => {
        await startGpsWatch();
        setIsPaused(false);
    };

    const finishTracking = async (save: boolean, name?: string, notes?: string) => {
        await stopGpsWatch();
        setIsTracking(false);
        setIsPaused(false);

        const { saveTrackOffline, markTrackSynced, deleteActiveTrack } = await import('../services/offlineTrackService');

        // Use local variable for currentTrack to avoid state update race conditions
        const trackToSave = currentTrack;

        if (save && trackToSave) {
            const finalTrack: TrackSession = {
                ...trackToSave,
                endTime: new Date().toISOString(),
                status: 'completed',
                distance: distanceTraveled,
                name: name || undefined,
                notes: notes || undefined
            };

            try {
                // 1. Save Offline Final (This is our source of truth until synced)
                await saveTrackOffline(finalTrack);
                console.log("Track saved locally successfully", finalTrack.id);

                // 2. Remove from "Active" store (since it is now a finished track)
                await deleteActiveTrack(finalTrack.id);

                // 3. Try Sync to Firestore
                if (navigator.onLine) {
                    try {
                        console.log("Attempting to sync track to Firestore...");
                        await saveTrack(finalTrack);
                        await markTrackSynced(finalTrack.id);
                        console.log("Track synced successfully to Firestore");
                    } catch (syncErr) {
                        console.warn("Sync failed, enqueuing for later. Error:", syncErr);
                        // Ensure it is queued for auto-sync
                        enqueueOperation('addTrack', { id: finalTrack.id });
                    }
                } else {
                    console.log("Offline mode: Track saved locally, enqueuing for background sync.");
                    enqueueOperation('addTrack', { id: finalTrack.id });
                }

            } catch (e) {
                console.error("CRITICAL ERROR saving track", e);
                setError("Error al guardar el recorrido. Se intentó guardar localmente.");
                // Even if it failed, we might want to keep the active track? 
                // For now, if offline save fails, it's a critical storage error.
            }
        } else if (!save && trackToSave) {
            // Discarding: remove from active store
            await deleteActiveTrack(trackToSave.id);
            console.log("Track discarded and removed from active store.");
        }

        setCurrentTrack(null);
        setDistanceTraveled(0);
        setElapsedTime(0);
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            releaseWakeLock();
        };
    }, []);

    return (
        <TrackingContext.Provider value={{ isTracking, isPaused, currentTrack, elapsedTime, startTracking, pauseTracking, resumeTracking, finishTracking, distanceTraveled, error }}>
            {children}
        </TrackingContext.Provider>
    );
};

export const useTracking = () => {
    const context = useContext(TrackingContext);
    if (context === undefined) {
        throw new Error('useTracking must be used within a TrackingProvider');
    }
    return context;
};
