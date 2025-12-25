# Sistema Offline - AgroMonitor AI

**Última actualización:** 23/12/2025 (v2.19)  
**Estado:** ✅ IMPLEMENTADO Y EN PRODUCCIÓN

---

## Resumen Ejecutivo

El sistema offline de AgroMonitor está **completamente implementado** y operativo en producción (https://agromonitor-f959f.web.app). Este documento describe la arquitectura implementada, no es una guía de configuración inicial.

### Capacidades Actuales
- ✅ **Cold-start offline:** La app arranca sin conexión previa (PWA completa)
- ✅ **Precaching:** 3.26 MB de assets críticos cacheados automáticamente
- ✅ **Queue System:** Cola persistente con retry logic y validation
- ✅ **IndexedDB:** Almacenamiento de multimedia con quota checking y timeout de 3s
- ✅ **Firebase Storage:** Timeout de 5s en uploadMedia para detección rápida de fallos
- ✅ **Detección Offline Anticipada:** Verificación de `navigator.onLine` antes de intentar operaciones en Firebase
- ✅ **localStorage Cache:** Sistema paralelo de cache local para visualización inmediata offline
- ✅ **Visualización Multimedia Offline:** Fotos y audios visibles inmediatamente después de guardar offline
- ✅ **lotSummaries Offline:** Paridad completa con monitorings (v2.16-v2.18)
- ✅ **Conflict Detection:** Sistema de detección de modificaciones concurrentes
- ✅ **Visual Feedback:** Indicador offline integrado en Layout con dropdown de detalles y estado en tiempo real
- ✅ **Diagnostics:** Herramientas de debugging en producción
- ✅ **Respuesta Rápida:** Guardado offline garantizado en <5 segundos (sin colgarse)
- ✅ **Compresión de Imágenes:** Reducción automática 70-80% con Canvas API

Índice
- Preparación y build
- Evitar CDNs en producción
- Configurar PWA / Service Worker (recomendado: `vite-plugin-pwa`)
- Refactorizar inicialización de Firebase
- Añadir `OfflineFallback` y login cacheado
- Pruebas y verificación
- Script recomendado para AI Studio
- Conversión a PDF / exportar
- Notas de seguridad y recomendaciones

---

## 1) Preparación y build (comandos)
Ejecutar desde la carpeta `agro` en AI Studio (ajusta ruta si es necesario):

```powershell
cd 'c:\path\to\workspace\agro'  # ajustar si es distinto
npm ci
npm run build
# Servir dist para pruebas locales (opcional)
npx serve dist -l 5000
```

Verifica que `http://localhost:5000` (o la URL del servidor) cargue correctamente online antes de probar offline.

---

## 2) Evitar dependencias CDN / importmap en producción
Problema: `index.html` usa un `importmap` que apunta a CDNs (p. ej. `aistudiocdn.com`, `www.gstatic.com`). En una cold-start offline el navegador no tiene esos scripts y la app falla.

Opciones:
- Recomendado: usar `npm run build` y servir la carpeta `dist` (bundles generados por Vite contienen React, Firebase, etc.) — no usar importmap en producción.
- Si no puedes eliminar `importmap` del repo, crear `index.prod.html` sin el bloque `<script type="importmap">` y usarlo en el pipeline antes del `npm run build`.

Comando para crear una copia sin el importmap (Linux/Unix shell):

```bash
cp index.html index.prod.html
awk 'BEGIN{inside=0} /<script type="importmap">/{inside=1;next} /<\/script>/{inside=0;next} !inside{print}' index.html > index.prod.html
mv index.prod.html index.html # opcional, hacer backup antes
```

---

## 3) Configurar PWA / Service Worker con `vite-plugin-pwa` (recomendado)
Instalación:

```powershell
npm install -D vite-plugin-pwa
```

Ejemplo de `vite.config.ts` (añadir al `plugins`):

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg','icon-192.png','icon-512.png'],
      manifest: {
        name: 'AgroMonitor AI',
        short_name: 'AgroMonitor',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'html-cache', expiration: { maxEntries: 10 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10 } }
          },
          {
            urlPattern: /\/assets\/.*$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'assets-cache', expiration: { maxEntries: 100 } }
          }
        ]
      }
    })
  ]
});
```

Beneficios: `vite-plugin-pwa` generará automáticamente el service worker durante `npm run build` e incluirá en el precache todos los archivos de `dist` (JS/CSS/HTML/assets), evitando la fragilidad de un `sw.js` manual con hashes.

---

## 4) Refactorizar inicialización de Firebase (deferred init)
Problema: la inicialización de Firebase en `services/firebase.ts` se hace en tiempo de import y puede requerir recursos externos.

Solución: mover la inicialización a una función `initFirebase()` que sea llamada asíncronamente tras el render inicial (p. ej. desde `SplashScreen` o `App` con `useEffect`).

Ejemplo de `services/firebase.ts`:

```ts
import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getStorage } from 'firebase/storage';

const firebaseConfig = { /* tu config */ };
let app: any = null;
let db: any = null;
let analytics: any = null;
let storage: any = null;

export const initFirebase = async (options?: { timeoutMs?: number }) => {
  if (app) return { app, db, analytics, storage };
  try {
    app = initializeApp(firebaseConfig);
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    storage = getStorage(app);
    if (typeof window !== 'undefined') {
      try { analytics = getAnalytics(app); } catch (e) { console.warn('Analytics init failed:', e); }
    }
  } catch (e) {
    console.warn('Firebase init error (continuando sin Firebase):', e);
    app = db = analytics = storage = null;
  }
  return { app, db, analytics, storage };
};

export { app as firebaseApp, db as firebaseDb, analytics as firebaseAnalytics, storage as firebaseStorage };
```

Llamada asíncrona en `App.tsx` o `SplashScreen`:

```tsx
import React, { useEffect } from 'react';
import { initFirebase } from './services/firebase';

const App: React.FC = () => {
  useEffect(() => {
    initFirebase().then(() => console.log('Firebase init (async)')).catch(err => console.warn(err));
  }, []);
  return <MainApp />;
};
```

Esto evita bloquear el UI cuando Firebase no puede inicializarse (offline).

---

## 5) Añadir `OfflineFallback` y login cacheado
### Componente `components/OfflineFallback.tsx`

```tsx
import React from 'react';

export const OfflineFallback: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h2 className="text-2xl font-bold mb-2">Modo offline</h2>
        <p className="mb-4">No se detecta conexión a internet. La aplicación funciona en modo limitado.</p>
        <div className="flex justify-center gap-4">
          {onRetry && <button onClick={onRetry} className="btn">Reintentar</button>}
        </div>
      </div>
    </div>
  );
};
```

Integrarlo en `App.tsx`: antes de renderizar la app, comprobar si `navigator.onLine` es `false` y si el service worker/precached assets existen; si no, mostrar `OfflineFallback` o permitir acceso en modo limitado.

### Login cacheado / sesión local
- `storageService` ya usa `localStorage` con `SESSION_KEY = 'agromonitor_session'`.
- Lógica recomendada: si la autenticación remota falla por red y existe `SESSION_KEY` en `localStorage`, permitir login local con PIN o usar esos datos para entrar en modo limitado.
- Seguridad: implementar expiración (ej. `session.savedAt`) y PIN de acceso local si guardás credenciales.

---

## 6) Ajustes en `sw.js` (si no usas plugin)
Si no usas `vite-plugin-pwa`, asegúrate de que `sw.js` incluya en `STATIC_URLS` todos los archivos de `dist` (index.html, assets/*.js, assets/*.css, icons). Es frágil (hashes), por eso el plugin es recomendado.

---

## 7) Pruebas y verificación
1. `npm run build`
2. `npx serve dist -l 5000`
3. Abrir `http://localhost:5000` (online)
4. DevTools → Application → Service Workers: comprobar `activated` y `controlling`.
5. DevTools → Application → Cache Storage: comprobar precache (workbox-precache o cache configurado) con `index.html` y bundles.
6. Simular offline (Network → Offline) y recargar: la app debe cargar en cold-start.
7. Verificar login offline: probar login con sesión guardada y/o PIN.

Comandos de verificación (bash/powershell):

```powershell
# Buscar service worker en dist
ls -la dist | Select-String -Pattern "sw|service-worker|workbox" -SimpleMatch
# Buscar precache manifest
Select-String -Path dist/** -Pattern "precache" -SimpleMatch
```

---

## 8) Timeouts Implementados (v2.11)

### Problema Resuelto
En v2.10 el botón de guardado podía quedarse "pensando" indefinidamente al intentar guardar con multimedia en modo offline, debido a Promesas sin timeout esperando respuestas de red que nunca llegaban.

### Solución: Triple Capa de Timeouts

#### 1. IndexedDB Timeout (3 segundos)
**Ubicación:** `services/indexedDBService.ts` función `saveBlobToIndexedDB()`

```typescript
return Promise.race<string>([
  new Promise<string>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(mediaBlob);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  }),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout: IndexedDB no responde (3s)')), 3000)
  )
]);
```

**Justificación:** 3 segundos es suficiente para operaciones de IndexedDB incluso en dispositivos lentos. Si supera este tiempo, hay un problema real (disco lleno, browser bloqueado).

#### 2. Firebase Storage Timeout (5 segundos)
**Ubicación:** `services/utils/mediaUtils.ts` función `uploadMedia()`

```typescript
export const uploadMedia = async (blobUrl: string, path: string): Promise<string> => {
    const uploadPromise = (async () => {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    })();
    
    const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Firebase Storage no responde (5s)')), 5000)
    );
    
    return Promise.race([uploadPromise, timeoutPromise]);
};
```

**Justificación:** 5 segundos permite detectar rápidamente si Firebase Storage no está disponible (offline o error de red) sin esperar timeouts por defecto del navegador (30-60s).

#### 3. Detección Offline Anticipada
**Ubicación:** `services/repositories/monitoringRepository.ts` funciones `addMonitoring()` y `updateMonitoring()`

```typescript
const isOffline = !navigator.onLine;

// Si offline, ir directamente al flujo de guardado local (sin try-catch)
if (!isOffline) {
    // MODO ONLINE: intentar guardar en Firebase
    try {
        // ... código de Firebase ...
        return; // Salir si exitoso
    } catch (error) {
        // Si falla, caer al flujo offline
    }
}

// MODO OFFLINE o error de Firebase: guardar en IndexedDB
// ... código de guardado local ...
```

**Ventajas:**
- **Respuesta inmediata** en modo offline (no espera timeout de Firebase)
- **Sin errores en consola** - elimina el throw/catch con `OFFLINE_MODE`
- **Flujo limpio** - separación clara entre modo online y offline

### Resultado
- ✅ Botón responde en máximo 3-5 segundos incluso si falla
- ✅ Guardado offline instantáneo al detectar `navigator.onLine === false`
- ✅ Sincronización automática exitosa al volver online
- ⚠️ Errores CORS de Firestore en consola son esperados y no afectan funcionalidad

---

## 8) Timeouts Implementados (v2.11)

### Problema Resuelto
En v2.10 el botón de guardado podía quedarse "pensando" indefinidamente al intentar guardar con multimedia en modo offline, debido a Promesas sin timeout esperando respuestas de red que nunca llegaban.

### Solución: Triple Capa de Timeouts

#### 1. IndexedDB Timeout (3 segundos)
**Ubicación:** `services/indexedDBService.ts` función `saveBlobToIndexedDB()`

```typescript
return Promise.race<string>([
  new Promise<string>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(mediaBlob);
    
    request.onsuccess = () => resolve(id);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  }),
  new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Timeout: IndexedDB no responde (3s)')), 3000)
  )
]);
```

**Justificación:** 3 segundos es suficiente para operaciones de IndexedDB incluso en dispositivos lentos. Si supera este tiempo, hay un problema real (disco lleno, browser bloqueado).

#### 2. Firebase Storage Timeout (5 segundos)
**Ubicación:** `services/utils/mediaUtils.ts` función `uploadMedia()`

```typescript
export const uploadMedia = async (blobUrl: string, path: string): Promise<string> => {
    const uploadPromise = (async () => {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        return await getDownloadURL(storageRef);
    })();
    
    const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Firebase Storage no responde (5s)')), 5000)
    );
    
    return Promise.race([uploadPromise, timeoutPromise]);
};
```

**Justificación:** 5 segundos permite detectar rápidamente si Firebase Storage no está disponible (offline o error de red) sin esperar timeouts por defecto del navegador (30-60s).

#### 3. Detección Offline Anticipada
**Ubicación:** `services/repositories/monitoringRepository.ts` funciones `addMonitoring()` y `updateMonitoring()`

```typescript
const isOffline = !navigator.onLine;

// Si offline, ir directamente al flujo de guardado local (sin try-catch)
if (!isOffline) {
    // MODO ONLINE: intentar guardar en Firebase
    try {
        // ... código de Firebase ...
        return; // Salir si exitoso
    } catch (error) {
        // Si falla, caer al flujo offline
    }
}

// MODO OFFLINE o error de Firebase: guardar en IndexedDB
// ... código de guardado local ...
```

**Ventajas:**
- **Respuesta inmediata** en modo offline (no espera timeout de Firebase)
- **Sin errores en consola** - elimina el throw/catch con `OFFLINE_MODE`
- **Flujo limpio** - separación clara entre modo online y offline

### Resultado
- ✅ Botón responde en máximo 3-5 segundos incluso si falla
- ✅ Guardado offline instantáneo al detectar `navigator.onLine === false`
- ✅ Sincronización automática exitosa al volver online
- ⚠️ Errores CORS de Firestore en consola son esperados y no afectan funcionalidad

---

## 9) Sistema de Visualización Offline (v2.14-v2.18)

### Problema Resuelto
Los usuarios guardaban monitoreos y cierres de lote con multimedia en modo offline pero no podían ver las fotos/audios en el historial o dashboard hasta que sincronizaran. Esto rompía el flujo de trabajo offline.

### Solución: Cache Local con Sistema de Eventos

#### Arquitectura
1. **localStorage como Cache Paralelo:** `localCacheService.ts`
   - Guarda copias de documentos offline en `localStorage` (separado de la queue)
   - Soporta múltiples colecciones: `monitorings` y `lotSummaries`
   - Emite evento `CustomEvent('localCacheUpdated')` cada vez que se agrega un documento

2. **DataContext Reactivo:**
   - Escucha evento `localCacheUpdated` con listener
   - Incrementa contador `localCacheVersion` para forzar re-render
   - Función `mergeDeduplicated()` combina arrays Firestore + localStorage
   - Elimina duplicados por `id` o `_operationId`

3. **Hooks de Enriquecimiento:**
   - `useOfflineMedia()` - Enriquece `monitorings` con fotos/audios de IndexedDB
   - `useOfflineLotSummaries()` - Enriquece `lotSummaries` con audios de IndexedDB
   - Crean blob URLs temporales para visualización inmediata

#### Flujo Completo
```
Usuario guarda offline
    ↓
Multimedia → IndexedDB (con IDs únicos)
Documento → localStorage (con _operationId y _offlineMedia)
    ↓
localCacheService.addToLocalCache() dispara evento
    ↓
DataContext escucha evento, incrementa localCacheVersion
    ↓
useEffect recombina: data.monitorings = Firestore + localStorage
    ↓
Vista llama useOfflineMedia(data.monitorings)
    ↓
Hook enriquece documentos con blob URLs de IndexedDB
    ↓
Usuario ve foto/audio inmediatamente
```

#### Sincronización y Limpieza
**autoSyncService.ts:**
- Después de sincronización exitosa:
  - `removeFromLocalCache('monitorings', operationId)`
  - `removeFromLocalCache('lotSummaries', operationId)`
  - Dispara evento para actualizar UI
- Blobs de IndexedDB se eliminan durante sincronización
- Cache local queda limpio automáticamente

### Archivos Clave
- `services/localCacheService.ts` - CRUD localStorage + eventos
- `services/offlineMediaResolver.ts` - Enriquecimiento con blobs IndexedDB
- `hooks/useOfflineMedia.ts` - Hooks React para enriquecer arrays
- `contexts/DataContext.tsx` - Listener y combinación de datos
- `views/HistoryView.tsx` - Uso de `useOfflineMedia()`
- `views/DashboardView.tsx` - Uso de `useOfflineLotSummaries()`

### Detección de Documentos Offline en UI
Los documentos offline no tienen `id` (asignado por Firebase), sino `_operationId` (UUID local).

**Patrón de detección:**
```typescript
// ❌ Incorrecto - falla con docs offline
if (document.id) { ... }

// ✅ Correcto - detecta online y offline
if (document.id || document._operationId) { ... }
```

Aplicado en:
- `components/dashboard/LotSituationTable.tsx` - Título modal, bloque reporte, feedbackStatus
- Lógica de visualización en múltiples vistas

### Resultado
- ✅ Fotos/audios visibles inmediatamente después de guardar offline
- ✅ Cierres de lote (lotSummaries) con audio reproducible offline
- ✅ Dashboard muestra estado correcto de lotSummaries offline
- ✅ Contador de muestreos incrementa correctamente (M1→M2→M3)
- ✅ Sin recargas necesarias - actualización reactiva automática
- ✅ Cache se limpia después de sincronización exitosa

---

## 10) Compresión de Imágenes (v2.15)

### Problema Resuelto
Las fotos fallaban al guardar con error "Failed to fetch blob from URL". Los blob URLs de objetos `File` son inestables y pueden expirar antes de ser procesados. No había compresión real, solo redimensionado teórico.

### Solución: Canvas API
**Ubicación:** `services/utils/mediaUtils.ts` función `compressImage()`

```typescript
export const compressImage = async (file: File): Promise<Blob> => {
  console.log('📸 Iniciando compresión de foto...');
  const originalSize = (file.size / 1024).toFixed(0);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      // Redimensionar proporcionalmente (max 1920x1920)
      let { width, height } = img;
      const MAX_DIM = 1920;
      
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = (height / width) * MAX_DIM;
          width = MAX_DIM;
        } else {
          width = (width / height) * MAX_DIM;
          height = MAX_DIM;
        }
      }
      
      // Renderizar en canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convertir a JPEG 85% calidad
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedSize = (blob.size / 1024).toFixed(0);
            const reduction = ((1 - blob.size / file.size) * 100).toFixed(0);
            console.log(`📸 Foto comprimida: ${originalSize}KB → ${compressedSize}KB (${reduction}% reducción)`);
            resolve(blob);
          } else {
            reject(new Error('Error al comprimir imagen'));
          }
          URL.revokeObjectURL(url);
        },
        'image/jpeg',
        0.85
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar imagen'));
    };
    
    img.src = url;
  });
};
```

### Resultado
- ✅ Reducción real de tamaño (promedio 70-80%)
- ✅ Blob URLs estables durante todo el proceso
- ✅ Menor consumo de Storage y ancho de banda
- ✅ Fotos se guardan confiablemente online y offline

---

## 11) Script `scripts/prepare_prod.sh` (opcional)
Guarda este script si querés automatizar en AI Studio.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
# Backup index
cp index.html index.html.bak || true
# Remove importmap block (unsafe but practical for CI)
awk 'BEGIN{inside=0} /<script type="importmap">/{inside=1;next} /<\/script>/{inside=0;next} !inside{print}' index.html.bak > index.html
npm ci
npm run build
# Start static server for manual test
npx serve dist -l 5000 &
echo "Server running at http://localhost:5000"
```

---

## 12) Conversión a PDF / exportar
Si querés un PDF desde este Markdown, podés usar `pandoc` o imprimir la página desde el navegador.

Ejemplos (PowerShell):

```powershell
# Usando pandoc (instalar Pandoc en AI Studio si no está)
pandoc agro/OFFLINE_GUIDE.md -o agro/OFFLINE_GUIDE.pdf

# Usando Node (markdown-pdf) - instalar global o local
npx markdown-pdf agro/OFFLINE_GUIDE.md -o agro/OFFLINE_GUIDE.pdf
```

O abrir `agro/OFFLINE_GUIDE.md` en el navegador (GitHub preview o editor) y exportar a PDF con Print → Save as PDF.

---

## 13) Notas de seguridad y recomendaciones
- Evita almacenar tokens sensibles en `localStorage` sin cifrado. Si permites login offline, usa PIN local y expiración.
- Versiona el cache (p. ej. `cache-v1`) para forzar actualizaciones controladas.
- Prueba la estrategia de actualización del SW (skipWaiting/clients.claim) y documenta cómo forzar la actualización en producción.
- Asegura HTTPS en el entorno donde quieras probar SW (SW requiere contexto seguro).

---

## 14) Troubleshooting Offline

### Síntomas y Soluciones

**1. Botón de guardar se queda "pensando"**
- **Causa:** Timeout de red o IndexedDB no responde
- **Solución:** Los timeouts de 3s/5s deberían evitar esto. Verificar consola para errores.
- **Diagnóstico:** `window.agroSystemDiagnostics()` en consola del navegador

**2. Foto/audio no aparece después de guardar offline**
- **Causa:** localStorage cache no se actualizó o hook de enriquecimiento no se ejecutó
- **Solución:** Recargar vista. Verificar que DataContext esté escuchando eventos.
- **Verificar:** `localStorage.getItem('agroLocalCache_monitorings')`

**3. Contador de muestreos no incrementa**
- **Causa:** Timing issue - componente re-renderiza antes de actualizar cache
- **Solución:** Ya implementado delay de 100ms en `useMonitoringForm.ts`
- **Verificar:** Que `onSuccess()` tenga el delay `await new Promise(resolve => setTimeout(resolve, 100))`

**4. Sincronización falla al volver online**
- **Causa:** Operación corrupta en queue o error de permisos Firebase
- **Solución:** `isValidOperation()` debería moverla a failed queue
- **Verificar:** `localStorage.getItem('offlineQueue')` y `localStorage.getItem('failedQueue')`

**5. lotSummary offline no muestra en Dashboard**
- **Causa:** Modal no detecta `_operationId` o filteredSummaries no usa hook enriquecedor
- **Solución:** Verificar que `useOfflineLotSummaries()` se aplique en DashboardView
- **Verificar:** Condiciones `if (document.id || document._operationId)`

---

## 15) Qué puedo hacer por vos desde aquí
- Generar los parches aplicables en este repo (`vite.config.ts`, `services/firebase.ts`, `components/OfflineFallback.tsx`, `scripts/prepare_prod.sh`).
- Ejecutar `npm run build` y pruebas aquí si me das permiso.
- Crear el `OFFLINE_GUIDE.pdf` localmente (si instalas `pandoc` o aceptás usar `npx markdown-pdf`).

Si querés que genere ya los archivos y parches en este workspace, decime y los creo ahora.

---

Archivo creado por: asistente (guía generada automáticamente).