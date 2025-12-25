
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { AppState } from '../types/ui';

export const subscribeToData = (
    ownerId: string, 
    onData: (data: AppState) => void, 
    onError: (error: any) => void
) => {
    const state: AppState = {
        companies: [], fields: [], plots: [], seasons: [], pests: [], crops: [], 
        agrochemicals: [], tasks: [], prescriptions: [], templates: [],
        assignments: [], monitorings: [], lotSummaries: []
    };
    
    const collections = [
        { key: 'companies', ref: collection(db, 'companies') },
        { key: 'fields', ref: collection(db, 'fields') },
        { key: 'plots', ref: collection(db, 'plots') },
        { key: 'seasons', ref: collection(db, 'seasons') },
        { key: 'pests', ref: collection(db, 'pests') },
        { key: 'crops', ref: collection(db, 'crops') },
        { key: 'agrochemicals', ref: collection(db, 'agrochemicals') },
        { key: 'tasks', ref: collection(db, 'tasks') },
        { key: 'prescriptions', ref: collection(db, 'prescriptions') },
        { key: 'templates', ref: collection(db, 'prescriptionTemplates') },
        { key: 'assignments', ref: collection(db, 'assignments') },
        { key: 'monitorings', ref: collection(db, 'monitorings') },
        { key: 'lotSummaries', ref: collection(db, 'lotSummaries') },
    ];

    const unsubscribes: Function[] = [];
    let hasEmittedInitial = false;
    let debounceTimer: NodeJS.Timeout | null = null;
    let pendingUpdatesCount = 0;

    // CRITICAL: Timeout para desbloquear UI si no hay respuesta
    const timeoutId = setTimeout(() => {
        if (!hasEmittedInitial) {
            console.warn('⏰ Timeout: Forzando carga inicial (3s)');
            hasEmittedInitial = true;
            onData({ ...state });
        }
    }, 3000);

    collections.forEach(({ key, ref }) => {
        const q = query(ref, where('ownerId', '==', ownerId));
        const unsub = onSnapshot(
            q, 
            {
                includeMetadataChanges: true // CRITICAL: Emite datos desde caché inmediatamente
            },
            (snapshot) => {
                (state as any)[key] = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
                
                // Logging para debugging offline
                if (snapshot.metadata.fromCache) {
                    console.log(`📦 ${key}: ${snapshot.size} docs (caché)`);
                } else {
                    console.log(`☁️ ${key}: ${snapshot.size} docs (servidor)`);
                }
                
                // Emitir en el PRIMER snapshot de cualquier colección (sin debounce)
                if (!hasEmittedInitial) {
                    clearTimeout(timeoutId);
                    hasEmittedInitial = true;
                    console.log('✅ Primera carga completada');
                    onData({ ...state });
                    return;
                }
                
                // Para actualizaciones posteriores, usar debouncing (500ms)
                // Esto reduce el número de re-renders y ahorra batería
                pendingUpdatesCount++;
                
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                
                debounceTimer = setTimeout(() => {
                    console.log(`🔄 Emitiendo actualización (${pendingUpdatesCount} cambios acumulados)`);
                    pendingUpdatesCount = 0;
                    onData({ ...state });
                }, 500);
            }, 
            (err) => {
                clearTimeout(timeoutId);
                console.error(`❌ Error en ${key}:`, err);
                
                // Si falla pero es por falta de conexión, intentar emitir estado vacío
                if (!hasEmittedInitial) {
                    hasEmittedInitial = true;
                    onData({ ...state });
                }
                
                onError(err);
            }
        );
        unsubscribes.push(unsub);
    });

    return () => {
        clearTimeout(timeoutId);
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        unsubscribes.forEach(u => u());
    };
};
