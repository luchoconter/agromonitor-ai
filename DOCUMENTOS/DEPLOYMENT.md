# Guía de Deployment - AgroMonitor AI

**Última actualización:** 20/12/2025  
**Versión:** v2.18

---

## 1. Configuración del Proyecto

### Firebase Hosting
- **Proyecto ID:** `agromonitor-f959f`
- **URL Producción:** https://agromonitor-f959f.web.app
- **Región:** us-central1 (predeterminado)

### Estructura de Archivos
```
AGRO final/
├── dist/                    # Build output (generado)
├── src/                     # Código fuente
├── firebase.json           # Configuración Firebase
├── .firebaserc             # Alias del proyecto
├── vite.config.ts          # Configuración Vite + PWA
└── .env                    # Variables de entorno (NO versionar)
```

---

## 2. Variables de Entorno

### Archivo `.env` (desarrollo y producción)
```bash
# Gemini API Key (Opcional - Solo para funciones de IA)
# Si está vacía, las funciones de IA mostrarán "API Key no configurada"
VITE_API_KEY=

# Nota: Las variables DEBEN empezar con VITE_ para estar disponibles en el cliente
```

### Obtener API Key de Gemini (Opcional)
1. Ir a https://makersuite.google.com/app/apikey
2. Crear o copiar una API key existente
3. Pegar en `.env` como `VITE_API_KEY=tu-clave-aqui`
4. Rebuild y redeploy

**⚠️ Seguridad:** La API key quedará expuesta en el bundle del cliente. Configura restricciones en Google Cloud Console:
- Restringir por dominio: `agromonitor-f959f.web.app`
- Establecer cuotas diarias
- Monitorear uso regularmente

---

## 3. Comandos de Deployment

### Build Local (Compilación)
```powershell
cd 'c:\Users\lucia\OneDrive\Escritorio\AGRO - TRABAJO SIN CONEXION\AGRO final'
npm run build
```

**Resultado esperado:**
- Tiempo: ~55-60 segundos
- Bundle principal: ~2.69 MB (gzip: ~746 KB)
- Precache: 9 entries (~3.26 MB)
- Output: carpeta `dist/`

### Deploy a Firebase Hosting
```powershell
firebase deploy --only hosting
```

**Proceso:**
1. Sube archivos de `dist/` a Firebase CDN
2. Genera versión nueva
3. Activa versión en producción
4. URL actualizada automáticamente

### Previsualizar Localmente (Opcional)
```powershell
# Servidor de desarrollo (hot reload)
npm run dev

# O servir el build de producción
npx serve dist -l 5000
```

---

## 4. PWA (Progressive Web App)

### Configuración Actual
- **Plugin:** `vite-plugin-pwa` v1.2.0
- **Service Worker:** Generado automáticamente en `dist/sw.js`
- **Estrategia:** `generateSW` con Workbox
- **Modo:** autoUpdate

### Assets Precacheados
El service worker precachea automáticamente:
- HTML principal (`index.html`)
- JavaScript bundles (`/assets/*.js`)
- CSS (`/assets/*.css`)
- Iconos PWA (`icon-192.png`, `icon-512.png`)
- Manifest (`manifest.webmanifest`)

### Runtime Caching
- **Google Fonts:** CacheFirst (365 días)
- **Unpkg libraries:** CacheFirst (30 días)
- **Google Maps tiles:** CacheFirst (7 días)
- **Assets locales:** CacheFirst

### Tamaño Máximo de Cache
- **Límite por archivo:** 4 MB
- **Total precacheado:** ~3.26 MB

---

## 5. Troubleshooting

### ❌ Error: "Redirect Loop"
**Síntoma:** Navegación infinita entre home → dashboard

**Causa:** El useEffect de redirección se ejecutaba en cada render.

**Solución Implementada:** Estado `hasRedirected` en `App.tsx` para ejecutar redirect solo una vez.

```typescript
const [hasRedirected, setHasRedirected] = React.useState(false);

useEffect(() => {
  if (!hasRedirected && !isLoadingData && currentUser && view === 'home') {
    setHasRedirected(true);
    // ... lógica de redirect
  }
}, [currentUser, isLoadingData, view, hasRedirected]);
```

### ❌ Error: "API Key must be set when running in a browser"
**Síntoma:** Pantalla en blanco al cargar la app.

**Causa:** `geminiService.ts` usaba `process.env.API_KEY` (Node.js) en lugar de `import.meta.env.VITE_API_KEY` (Vite).

**Solución Implementada:** Migración a `import.meta.env.VITE_API_KEY` en todos los servicios.

### ❌ Warning: "cdn.tailwindcss.com should not be used in production"
**Causa:** `index.html` incluía CDN de Tailwind para desarrollo.

**Solución Implementada:** Eliminado `<script src="https://cdn.tailwindcss.com"></script>`. Tailwind se compila via PostCSS en build.

### ❌ Fotos/Audios no aparecen en Historial
**Síntoma:** Los registros de monitoreo no muestran multimedia.

**Causa:** Faltaba código de renderizado en `HistoryView.tsx` (existía en AGRO offline pero no en AGRO final).

**Solución Implementada:**
- Agregado botón de audio con Play/Pause
- Agregado miniatura de foto (24x24) clickeable
- Agregado Modal de preview de imagen
- Ajustado padding para evitar superposición de botones

---

## 6. Monitoreo Post-Deploy

### Console Warnings Esperados (No Críticos)
```
⚠️ Tailwind content pattern matching node_modules
   → Configuración de Tailwind, no afecta funcionalidad

⚠️ Some chunks are larger than 500 kB
   → Esperado para app completa, considerar code-splitting futuro

⚠️ Recharts: width/height warnings
   → Orden de renderizado de gráficos, no afecta visualización

⚠️ Audio base64 decode errors (data:audio/mp3)
   → Notification sounds, no crítico
```

### Verificaciones Post-Deploy
- [ ] ✅ App carga sin pantalla en blanco
- [ ] ✅ Login funciona correctamente
- [ ] ✅ Navegación entre vistas sin loops
- [ ] ✅ PWA instala correctamente (Add to Home Screen)
- [ ] ✅ Fotos y audios visibles en Historial
- [ ] ✅ Funciones offline funcionan (modo avión)

### Herramientas de Diagnóstico
En la consola del navegador:
```javascript
// Ver estado del sistema offline
agroSystemDiagnostics()

// Información detallada de storage
window.indexedDB.databases()
```

---

## 7. Rollback (Reversión)

Si un deploy causa problemas:

```powershell
# Ver historial de versiones
firebase hosting:channel:list

# Revertir a versión anterior
firebase hosting:rollback
```

O desde la consola web:
1. Ir a https://console.firebase.google.com/project/agromonitor-f959f/hosting
2. Pestaña "Release history"
3. Click en "⋮" de la versión anterior → "Rollback"

---

## 8. Checklist de Deploy

Antes de cada deploy a producción:

- [ ] `npm run build` exitoso sin errores
- [ ] Tests manuales en local (`npm run dev`)
- [ ] Verificar `.env` tiene valores correctos
- [ ] Commit de cambios en Git (opcional pero recomendado)
- [ ] `firebase deploy --only hosting`
- [ ] Verificar app en https://agromonitor-f959f.web.app
- [ ] Probar login con usuario de prueba
- [ ] Verificar una funcionalidad crítica (ej: crear monitoreo)

---

## 9. Recursos

- **Firebase Console:** https://console.firebase.google.com/project/agromonitor-f959f
- **Hosting Dashboard:** https://console.firebase.google.com/project/agromonitor-f959f/hosting
- **Vite PWA Plugin Docs:** https://vite-pwa-org.netlify.app/
- **Workbox Docs:** https://developer.chrome.com/docs/workbox/

---

**Última versión desplegada:** 20/12/2025 - v2.18  
**Estado:** ✅ PRODUCCIÓN ESTABLE CON OFFLINE COMPLETO
**Próxima actualización programada:** TBD


## 10. Despliegue de Pruebas con Canales de Preview (Firebase Hosting)

Desde diciembre 2025, se recomienda utilizar canales de preview para probar nuevas versiones de la app sin afectar el entorno de producción ni a los usuarios activos.

### ¿Qué es un canal de preview?
Un canal de preview es una URL temporal e independiente generada por Firebase Hosting, donde puedes desplegar y validar cambios antes de publicarlos en producción. Ejemplo de URL: `https://<canal>--<proyecto>.web.app`

### Ventajas
- No interrumpe el uso de la app en producción
- Permite compartir la URL de pruebas para feedback
- Expira automáticamente (por defecto, 7 días), pero puedes renovarlo o crear uno nuevo

### Comandos para crear un canal de preview
1. Compila la app:
   ```powershell
   npm run build
   ```
2. Despliega en un canal de preview (ejemplo: "pruebas"):
   ```powershell
   firebase hosting:channel:deploy pruebas --project agromonitor-f959f
   ```
3. Accede a la URL generada y valida los cambios.

### Consideraciones
- La base de datos será la misma que producción, salvo que configures otro proyecto de Firebase.
- Los canales de preview no reemplazan el despliegue principal.
- Puedes eliminar el canal cuando termines:
   ```powershell
   firebase hosting:channel:delete pruebas --project agromonitor-f959f
   ```

Más información: [Firebase Hosting Preview Channels](https://firebase.google.com/docs/hosting/channel-management)
