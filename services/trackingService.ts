import { TrackPoint } from '../types/tracking';

export interface Stop {
    lat: number;
    lng: number;
    startTime: number;
    endTime: number;
    durationMinutes: number;
}

export const calculateStops = (points: TrackPoint[], minDurationMinutes: number = 1, radiusKm: number = 0.03): Stop[] => {
    if (!points || points.length < 2) return [];

    const stops: Stop[] = [];
    let anchorIdx = 0;

    for (let i = 1; i < points.length; i++) {
        const anchor = points[anchorIdx];
        const current = points[i];

        // Safety check for invalid coords
        if (!anchor.lat || !anchor.lng || !current.lat || !current.lng) continue;

        const dist = calculateDistance(anchor.lat, anchor.lng, current.lat, current.lng);

        if (dist > radiusKm) {
            // Movement detected, check if we were stopped
            const startTime = new Date(anchor.timestamp).getTime();
            const endTime = new Date(points[i - 1].timestamp).getTime();
            const durationMinutes = (endTime - startTime) / (1000 * 60);

            if (durationMinutes >= minDurationMinutes) {
                stops.push({
                    lat: anchor.lat,
                    lng: anchor.lng,
                    startTime,
                    endTime,
                    durationMinutes
                });
            }
            anchorIdx = i; // Reset anchor to new position
        }
    }

    // Check stop at the end
    const lastIdx = points.length - 1;
    if (anchorIdx < lastIdx) {
        const anchor = points[anchorIdx];
        const startTime = new Date(anchor.timestamp).getTime();
        const endTime = new Date(points[lastIdx].timestamp).getTime();
        const durationMinutes = (endTime - startTime) / (1000 * 60);

        if (durationMinutes >= minDurationMinutes) {
            stops.push({
                lat: anchor.lat,
                lng: anchor.lng,
                startTime,
                endTime,
                durationMinutes
            });
        }
    }

    return stops;
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
};

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// Wake Lock API
let wakeLock: any = null;

export const requestWakeLock = async (): Promise<boolean> => {
    try {
        if ('wakeLock' in navigator) {
            // Release previous lock if exists
            if (wakeLock !== null) {
                try {
                    await wakeLock.release();
                } catch (e) {
                    // Ignore if already released
                }
            }
            
            wakeLock = await (navigator as any).wakeLock.request('screen');
            
            // Listen for automatic release (e.g., when app goes to background)
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released automatically');
                wakeLock = null;
            });
            
            console.log('Wake Lock is active');
            return true;
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
        wakeLock = null;
    }
    return false;
};

export const releaseWakeLock = async () => {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        console.log('Wake Lock released');
    }
};

export const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'));
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        }
    });
};
