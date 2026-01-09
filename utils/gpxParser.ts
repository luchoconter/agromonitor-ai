import { TrackPoint, TrackSession } from '../types/tracking';
import { calculateDistance } from '../services/trackingService';

export const parseGpxAndCreateSession = async (
    file: File,
    currentUser: { id: string; name: string; email: string }
): Promise<TrackSession> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                const trkpts = xmlDoc.querySelectorAll('trkpt');
                if (!trkpts || trkpts.length === 0) {
                    reject(new Error("No se encontraron puntos de rastreo en el archivo GPX."));
                    return;
                }

                const points: TrackPoint[] = [];
                let totalDistance = 0;

                for (let i = 0; i < trkpts.length; i++) {
                    const pt = trkpts[i];
                    const lat = parseFloat(pt.getAttribute('lat') || '0');
                    const lon = parseFloat(pt.getAttribute('lon') || '0');

                    const timeNode = pt.querySelector('time');
                    const time = timeNode ? new Date(timeNode.textContent || '').getTime() : Date.now();

                    // Algunos GPX tienen speed, otros no. GPS Logger suele tenerlo.
                    // Intentamos leer extensions si speed no est\u00e1 directo, o calcularlo? 
                    // Por simplicidad, leemos si est\u00e1, sino null.
                    const speedNode = pt.querySelector('speed');
                    const speed = speedNode ? parseFloat(speedNode.textContent || '0') : null;

                    const currentPoint: TrackPoint = {
                        lat,
                        lng: lon,
                        timestamp: time,
                        accuracy: 0, // GPX no siempre tiene accuracy visible f\u00e1cilmente
                        speed,
                        heading: null
                    };

                    points.push(currentPoint);

                    // Calcular distancia acumulada
                    if (i > 0) {
                        const prev = points[i - 1];
                        totalDistance += calculateDistance(prev.lat, prev.lng, lat, lon);
                    }
                }

                if (points.length === 0) {
                    reject(new Error("No se pudieron extraer puntos validos."));
                    return;
                }

                // Intentar sacar nombre del track
                const trkName = xmlDoc.querySelector('trk > name')?.textContent || file.name;

                // Crear Session
                const startTime = new Date(points[0].timestamp).toISOString();
                const endTime = new Date(points[points.length - 1].timestamp).toISOString();

                // Generar ID temporal (o dejar que backend/storage lo maneje si fuera necesario, pero la interfaz lo pide)
                // Usaremos crypto si est\u00e1 disponible o random
                const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

                const session: TrackSession = {
                    id,
                    userId: currentUser.id,
                    userName: currentUser.name || currentUser.email,
                    startTime,
                    endTime,
                    points,
                    distance: totalDistance,
                    status: 'synced', // Asumimos que al importar ya queda listo para "guardarse" como finalizado
                    name: `Imp: ${trkName}`,
                    notes: `Importado desde ${file.name}`,
                    synced: false // A\u00fan no est\u00e1 en firebase hasta que se guarde
                };

                resolve(session);

            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("Error al leer el archivo."));
        };

        reader.readAsText(file);
    });
};
