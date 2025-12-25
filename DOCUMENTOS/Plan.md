
# Plan de Desarrollo y Roadmap

## Roadmap Actualizado (v2.18)

### Fase 1: Estructura y Contexto (✅ COMPLETADO)
- [x] CRUD Jerárquico (Empresa/Campo/Lote/Campaña).
- [x] Hub de Carga de Estructura con Filtros en Cascada.
- [x] Gestión de Superficie e Importación CSV de Lotes.
- [x] Planificación de Siembra (Asignación de Cultivos).
- [x] **Borrado en Cascada (Integridad Referencial).**

### Fase 2: Experiencia de Muestreo (✅ COMPLETADO)
- [x] Semáforo Visual.
- [x] Captura Multimedia (Foto/Audio) con Compresión.
- [x] Geolocalización GPS.
- [x] Modo Oscuro.
- [x] Grabación de Audio Real y Subida a Cloud.
- [x] Numeración Diaria Inteligente.

### Fase 3: Backend, Seguridad y Offline (✅ COMPLETADO)
- [x] **Integración Firebase Firestore.**
- [x] **Persistencia Offline (PWA).**
- [x] **Arquitectura Multi-Tenant.**
- [x] **Cola de Subida (IndexedDB).**
- [x] **Gestión de Costos Cloud (Limpieza de Storage).**
- [x] **Seguridad de Borrado (Confirmación con Contraseña).**
- [x] **Sistema Offline Robusto:** Retry logic, quota checking, queue validation, conflict detection.
- [x] **OfflineStatusBar:** Indicador visual de estado y operaciones pendientes.
- [x] **Cache Service:** Sistema de caché optimizado con expiración automática.
- [x] **Diagnostics:** Herramientas de debugging en producción (`agroSystemDiagnostics()`).
- [x] **Firebase Hosting:** Deploy automatizado a producción (agromonitor-f959f.web.app).
- [x] **Timeouts Inteligentes:** IndexedDB (3s) y Firebase Storage (5s) para respuesta rápida.
- [x] **Visualización Offline:** localStorage cache + hooks para ver multimedia inmediatamente.
- [x] **Compresión de Imágenes:** Canvas API con reducción 70-80% de tamaño.
- [x] **lotSummaries Offline:** Paridad completa con monitorings (v2.16-v2.18).

### Fase 4: Refactorización "Vibe Coding" (✅ COMPLETADO v2.0)
- [x] **Desacople de Tipos y Repositorios.**
- [x] **Custom Hooks de Negocio.**
- [x] **Managers Explícitos.**

### Fase 5: Dashboard y Reportes (✅ COMPLETADO)
- [x] **Mapa Interactivo Avanzado (Modos Semáforo/Recorrida/Plagas).**
- [x] **Filtros Históricos en Mapa.**
- [x] **KPIs Dinámicos y Gráficos Drill-down.**
- [x] **Análisis IA (Gemini) Curado (Solo Ingeniero).**
- [x] **Exportación Excel y PDF Profesional.**
- [x] **Feedback Técnico (Ingeniero <-> Operario).**
- [x] **Bitácora de Lote (Timeline Histórico).**
- [x] **Optimización Mobile del Dashboard (v2.2).**
- [x] **Integración Climática (Open-Meteo).**
- [x] **Separación Visual de Roles (Ingeniero vs Cliente) en Dashboard (v2.9).**

### Fase 6: Gestión Económica y Recetas (✅ COMPLETADO PARCIALMENTE)
- [x] **Módulo de Recetas:** Creación, Historial, Plantillas y PDF.
- [x] **Logística de Recetas:** Clonado, Suma de lotes y Bifurcación (Split) en edición.
- [x] **Catálogo de Insumos:** ABM de Agroquímicos y Tareas.
- [x] **Persistencia Imágenes Plagas:** Subida real a Cloud Storage.
- [ ] Control de Stock (Entradas/Salidas).
- [ ] Calculadora de Costos por Lote.

---

## Changelog
*   **v2.18:** Fix contador de muestreos (timing issue con delay 100ms) y timeout lotSummary sin audio (3s). Sistema offline completamente estable.
*   **v2.17:** Fix numeración de muestreos después de cierre de lote (logic hasLotSummaryToday - posteriormente revertido en v2.18).
*   **v2.16:** Extensión de sistema offline a lotSummaries. Soporte multi-colección en localCacheService. Hook useOfflineLotSummaries.
*   **v2.15:** Fix crítico de fotos. Compresión real con Canvas API (JPEG 85%, max 1920px). Blob URLs estables. Reducción 70-80% tamaño.
*   **v2.14:** Sistema de visualización offline completo. localStorage cache + eventos + hooks. Multimedia visible inmediatamente después de guardar offline.
*   **v2.12-v2.13:** Iteraciones fallidas de visualización offline. Creación de offlineMediaResolver y useOfflineMedia inicial.
*   **v2.11:** Fix crítico de botón tildado en modo offline. Timeouts en IndexedDB (3s) y Firebase Storage (5s). Detección offline anticipada con `navigator.onLine`. Refactorización de flujo sin throw/catch. Guardado offline ahora responde en <5s.
*   **v2.10:** Sistema Offline Mejorado (retry logic, quota checking, debouncing, conflict detection). Firebase Hosting deployment. Fixes críticos: redirect loop, API keys, historial multimedia. Documentación completa de deployment.
*   **v2.9:** UX Dashboard refinada: separación visual de columnas Ingeniero/Cliente, mapa interactivo con filtrado por leyenda y paleta de colores diferenciada para presupuesto.
*   **v2.8:** Reportes PDF Profesionales (con captura de mapas/gráficos). Bitácora de Lote (Timeline). Lógica de Recetas avanzada (Bifurcación, Clonado). Ajustes de seguridad en roles.
*   **v2.7:** Dashboard Estratégico. Mapa con modos Semáforo (agrupado) y Recorrida (líneas). Filtros de fecha en mapa. Mejoras UX en Tabla de Situación (Modal Obs y Multimedia).
*   **v2.6:** Seguridad Reforzada. Flujo de eliminación de 2 pasos (Advertencia + Contraseña) para estructuras críticas. Fix de persistencia de imágenes en catálogo.
*   **v2.5:** Optimización de costos. Implementación de **Deep Delete** y **Garbage Collection** (eliminación automática de fotos/audios en Storage al borrar registros).
*   **v2.4:** Integridad de datos (Borrado en Cascada de estructura) y UX mejorada con Modales de confirmación personalizados.
*   **v2.3:** Integración de clima (Open-Meteo), Widget climático y toggle de capas de mapa (Satélite/Plano).
*   **v2.2:** Rediseño minimalista del Dashboard en móvil, visualización de valores en gráficos.
*   **v2.1:** Módulo de Recetas completo, PDF generator, Dashboard Drill-down.
*   **v2.0 (Refactorizado):** Reestructuración total del código. Modularización.
*   **v1.4:** Production Ready Fixes.
*   **v1.0:** Estabilidad Offline Total.
