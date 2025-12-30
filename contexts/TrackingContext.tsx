import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';
import { TrackSession, TrackPoint } from '../types/tracking';
import { calculateDistance, requestWakeLock, releaseWakeLock } from '../services/trackingService';
import { saveTrack } from '../services/repositories/trackRepository';
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

    // Timer Logic
    useEffect(() => {
        if (isTracking && !isPaused) {
            timerRef.current = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
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

        // Start GPS
        await startGpsWatch();
    };

    const startGpsWatch = async () => {
        const ok = await requestWakeLock();
        if (!ok) console.warn("No se pudo activar WakeLock");

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, speed, heading } = position.coords;
                const timestamp = position.timestamp;

                // Simple filter: accuracy must be better than 50m
                if (accuracy > 50) return;

                const newPoint: TrackPoint = {
                    lat: latitude,
                    lng: longitude,
                    timestamp,
                    accuracy,
                    speed,
                    heading
                };

                // OPTIMIZATION: Smart Distance Filter (10 meters) causes less points to be stored
                // while maintaining map quality.
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
                    if (dist > 0.010) { // 10 meters min distance
                        shouldSave = true;
                    }
                }

                if (shouldSave) {
                    setCurrentTrack(prev => {
                        if (!prev) return null;
                        return { ...prev, points: [...prev.points, newPoint] };
                    });

                    if (lastPointRef.current) {
                        setDistanceTraveled(prev => prev + dist);
                    }
                    lastPointRef.current = newPoint;
                }
            },
            (err) => {
                console.error(err);
                setError(err.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
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
    };

    const resumeTracking = async () => {
        await startGpsWatch();
        setIsPaused(false);
    };

    const finishTracking = async (save: boolean, name?: string, notes?: string) => {
        await stopGpsWatch();
        setIsTracking(false);
        setIsPaused(false);

        if (save && currentTrack) {
            const finalTrack: TrackSession = {
                ...currentTrack,
                endTime: new Date().toISOString(),
                status: 'completed',
                distance: distanceTraveled,
                name: name || undefined,
                notes: notes || undefined
            };

            try {
                // 1. Save Offline FIRST (Critical for reliability)
                const { saveTrackOffline, markTrackSynced } = await import('../services/offlineTrackService');
                await saveTrackOffline(finalTrack);

                // 2. Try Sync
                if (navigator.onLine) {
                    try {
                        await saveTrack(finalTrack);
                        await markTrackSynced(finalTrack.id);
                        finalTrack.status = 'synced';
                        finalTrack.synced = true;
                    } catch (syncErr) {
                        console.warn("Sync failed, track saved offline", syncErr);
                        // No error shown to user, it's safe offline
                    }
                } else {
                    console.log("Offline mode: Track saved locally.");
                }

            } catch (e) {
                console.error("Error saving track", e);
                setError("Error al guardar el recorrido.");
            }
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
