import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDrjOXxh9_3thgBHuv1HqmFP1Hg4QQU0Lc",
  authDomain: "agromonitor-f959f.firebaseapp.com",
  projectId: "agromonitor-f959f",
  storageBucket: "agromonitor-f959f.firebasestorage.app",
  messagingSenderId: "69369549604",
  appId: "1:69369549604:web:31b31badb77ec1b87d99b1",
  measurementId: "G-X8PGRHJ10C"
};

// Inicializar variables
let app;
let db: any;
let analytics;
let storage: any;

try {
    // Inicializar Firebase (Usando paquetes locales instalados via npm o CDN)
    app = initializeApp(firebaseConfig);
    
    // Inicializar Firestore con Persistencia Offline explícita (IndexedDB)
    // Esto permite que la app cargue datos cacheados inmediatamente sin esperar al timeout de red
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });

    // Inicializar Storage
    storage = getStorage(app);
    
    // Analytics (Falla suave si no hay red o bloqueador de anuncios)
    if (typeof window !== 'undefined') {
        try {
            analytics = getAnalytics(app);
        } catch (analyticsError) {
            console.warn("Analytics omitido (Offline/Blocked):", analyticsError);
        }
    }
    
    console.log("Firebase initialized with Offline Persistence");
} catch (error) {
    console.error("CRITICAL: Error inicializando Firebase:", error);
}

export { db, app, analytics, storage };