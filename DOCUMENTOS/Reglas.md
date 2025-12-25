
# Reglas y Filosofía del Proyecto AgroMonitor

## 1. Principios Fundamentales (Visión del Cliente)
Estos principios son el eje central del desarrollo y no son negociables.

### A. Simplicidad y Agilidad Extrema
*   **La Regla de Oro:** La carga de datos debe llevar el menor tiempo posible.
*   **Simplificación:** No se cuentan especies individuales si no es crítico. Se prioriza "¿Cuánto hay?" (Severidad) sobre "¿Qué hay exactamente?".
*   **Input:** Uso de "Semáforos" y botones grandes. Texto libre y notas de voz para detalles, evitando formularios complejos de mil campos.
*   **Datos Automáticos:** El sistema debe inferir todo lo posible (Hora, Ubicación, **Clima**).

### B. Modelo de Negocio: Consultora Agronómica (SaaS)
*   **Multi-Tenancy:** La aplicación funciona como un servicio para Ingenieros/Consultoras.
*   **Propiedad de Datos:** Los datos pertenecen al **Ingeniero**. El Operario y el Cliente son actores secundarios que interactúan con los datos del Ingeniero.
*   **Aislamiento:** Un Ingeniero NUNCA debe ver los lotes, plagas o campañas de otro Ingeniero.

### C. Estrategia PWA y Mobile First
*   **Mobile First:** La interfaz se diseña priorizando la pantalla del celular (dispositivo principal de campo). La versión de escritorio es complementaria.
*   **PWA (Progressive Web App):** La aplicación debe sentirse como una app nativa.

## 2. Roles de Usuario (Jerarquía Estricta)
1.  **Ingeniero / Administrador:** Dueño de la cuenta y datos. Crea catálogos y estructura.
2.  **Operario:** Creado por el Ingeniero. Carga datos en todos los campos.
3.  **Cliente:** Creado por el Ingeniero. Solo lectura de su propia empresa.

## 3. Filosofía Offline-First
*   **Persistencia Local Inmediata:** Guardado instantáneo en base de datos local (Firestore Cache).
*   **Feedback Visual:** Toasts para indicar estado de sincronización.
*   **Sin Bloqueos:** La UI no espera a la red.

## 4. Servicios Externos
*   **IA (Gemini):** Para análisis estratégico y checklists.
*   **Clima (Open-Meteo):** Integración gratuita sin API Key para reducir fricción de configuración. Obtiene clima actual y pronósticos basados en lat/lng.
*   **Mapas (Leaflet + Google Tiles):** Uso de tiles híbridos y vectoriales.

## 5. UX/UI Específica
*   **Semáforo:** Rojo, Amarillo, Verde (Uso estricto para estado sanitario).
*   **Paleta Financiera:** Para temas de presupuesto/dinero, usar escala de Azules/Violetas, NUNCA usar semáforo para evitar confusión con alertas.
*   **Claridad de Roles:** En vistas compartidas (como tablas), diferenciar visualmente qué columnas corresponden a responsabilidad técnica (Ingeniero) y cuáles a operativa (Cliente/Contratista).
*   **Multimedia:** Foto + Audio Real.
*   **Borrado Optimista:** La UI reacciona antes que el backend.
*   **Interacción Segura (Protocolo v2.6):**
    *   NUNCA usar `window.confirm`.
    *   **Acciones Destructivas Mayores** (Borrar Empresa/Campo/Lote): Requieren confirmación en **2 pasos**.
        1.  Modal de Advertencia explicita (Cascada).
        2.  Input de Contraseña del Administrador para proceder.

## 6. Arquitectura de Código (V2.0 - Modular & AI Friendly)

Para facilitar el mantenimiento mediante IA (Vibe Coding) y reducir errores, se sigue una arquitectura estricta:

### A. Separación de Responsabilidades (Layers)
1.  **Views (`views/`):** Componentes "tontos" de alto nivel. Solo orquestan el layout. No contienen lógica de negocio ni llamadas directas a servicios.
2.  **Hooks (`hooks/`):** Contienen TODA la lógica de estado y negocio (`useMonitoringForm`, `useLotSummary`). Las vistas consumen estos hooks.
3.  **Managers (`components/management/`):** Componentes **explícitos** para ABM (Alta/Baja/Modificación).
    *   *Regla:* Preferimos tener `CompanyManager.tsx` y `PlotManager.tsx` separados.
4.  **Repositories (`services/repositories/`):** Acceso a datos puro. Firestore/Auth logic.
5.  **Types (`types/`):** Definiciones divididas por dominio (`models`, `ui`, `auth`).

### B. Integridad de Datos y Recursos (Regla de Oro Backend)
*   **Borrado Profundo (Deep Delete):** Al eliminar un registro padre (Empresa), se utiliza el servicio `deepDeleteService` para eliminar recursivamente hijos y nietos (Campos, Lotes, Monitoreos).
*   **Limpieza de Storage (Garbage Collection):** La eliminación de registros DEBE ir acompañada de la eliminación física de sus archivos (fotos/audios) en Firebase Storage para evitar costos.

### C. Gestión de Estado
*   **Context API:** Para estado global de la sesión (`AuthContext`) y caché de datos (`DataContext`).
*   **Local State:** Para formularios y UI efímera, manejado dentro de Custom Hooks.
