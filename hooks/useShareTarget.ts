import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { saveTrack } from '../services/repositories/trackRepository';
import { TrackSession, TrackPoint } from '../types/tracking';

export const useShareTarget = () => {
    const { currentUser } = useAuth();
    const { showNotification } = useUI();
    const processingRef = useRef(false);

    useEffect(() => {
        // Use native URLSearchParams since we don't have react-router-dom
        const searchParams = new URLSearchParams(window.location.search);
        const action = searchParams.get('action');

        if (action === 'import_shared' && !processingRef.current) {
            if (!currentUser) {
                showNotification('Debes iniciar sesión para importar rutas.', 'warning');
                return;
            }

            processingRef.current = true;

            const handleImport = async () => {
                try {
                    // Access IndexedDB directly to retrieve the file
                    const file = await new Promise<File | null>((resolve, reject) => {
                        const request = indexedDB.open('agromonitor-share', 1);

                        request.onsuccess = (event: any) => {
                            const db = event.target.result;
                            if (!db.objectStoreNames.contains('shared_files')) {
                                resolve(null);
                                return;
                            }
                            const transaction = db.transaction(['shared_files'], 'readwrite');
                            const objectStore = transaction.objectStore('shared_files');
                            const getRequest = objectStore.get('latest_gpx');

                            getRequest.onsuccess = () => {
                                resolve(getRequest.result);
                                // Cleanup immediately
                                objectStore.delete('latest_gpx');
                            };
                            getRequest.onerror = () => reject(getRequest.error);
                        };
                        request.onerror = () => reject(request.error);
                    });

                    if (!file) {
                        throw new Error('No se encontró el archivo compartido');
                    }

                    const text = await file.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, "text/xml");

                    const trkpts = xmlDoc.getElementsByTagName('trkpt');
                    const points: TrackPoint[] = [];

                    for (let i = 0; i < trkpts.length; i++) {
                        const pt = trkpts[i];
                        const lat = parseFloat(pt.getAttribute('lat') || '0');
                        const lon = parseFloat(pt.getAttribute('lon') || '0');
                        const timeNode = pt.getElementsByTagName('time')[0];
                        const time = timeNode ? new Date(timeNode.textContent || '').getTime() : Date.now();

                        // Basic GPX import
                        points.push({
                            lat,
                            lng: lon, // Mapped to lng
                            timestamp: time,
                            accuracy: 10, // Default assume good GPS
                            speed: 0,
                            heading: 0
                        });
                    }

                    if (points.length === 0) {
                        throw new Error('No se encontraron puntos válidos en el archivo GPX');
                    }

                    // Create Track Session
                    const newTrack: TrackSession = {
                        id: crypto.randomUUID(),
                        userId: currentUser.uid, // user.uid based on your models
                        userName: currentUser.name || currentUser.email || 'Usuario', // Adjust based on your User model
                        startTime: new Date(points[0].timestamp).toISOString(),
                        endTime: new Date(points[points.length - 1].timestamp).toISOString(),
                        points: points,
                        distance: calculateTotalDistance(points),
                        status: 'completed',
                        synced: false,
                        name: `Ruta Importada ${new Date().toLocaleDateString()}`,
                        notes: 'Importada desde archivo externo (GPX)',
                    };

                    await saveTrack(newTrack);
                    showNotification('Ruta importada con éxito!', 'success');

                } catch (error) {
                    console.error('Error importando GPX:', error);
                    showNotification('Error al importar la ruta.', 'error');
                } finally {
                    processingRef.current = false;
                    // Clear the param using history API
                    const newParams = new URLSearchParams(window.location.search);
                    newParams.delete('action');
                    const newUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
                    window.history.replaceState({}, '', newUrl);
                }
            };

            handleImport();
        }
    }, [currentUser, showNotification]);
};

// Helper for distance (Haversine simplified or simple euclidean for short dists, but better use calc)
function calculateTotalDistance(points: TrackPoint[]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += getDistanceFromLatLonInKm(
            points[i].lat, points[i].lng,
            points[i + 1].lat, points[i + 1].lng
        );
    }
    return total;
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}
