He completado la implementación de la visualización de detenciones en las rutas GPS.

### Cambios Realizados:

1.  **Lógica Centralizada de Detección de Paradas**:
    *   Creé la función `calculateStops` en `services/trackingService.ts`.
    *   Esta función detecta automáticamente paradas de más de **1 minuto** dentro de un radio de **30 metros**.
    *   Ahora, cualquier parte de la aplicación que necesite saber sobre las detenciones usa esta misma lógica, garantizando consistencia.

2.  **Historial de Rutas GPS (Tabla)**:
    *   Agregué la columna **"Detenciones"** a la tabla en `Historial de Rutas GPS`.
    *   Muestra el número total de paradas detectadas en cada ruta, acompañado de un ícono de pausa para fácil identificación.
    *   Esto permite identificar rápidamente qué recorridos tuvieron interrupciones significativas sin tener que abrir el mapa.

3.  **Visualización en el Mapa**:
    *   Actualicé la visualización del mapa (`MapSection.tsx`) para usar la nueva lógica compartida.
    *   Las paradas se materializan en el mapa con un marcador naranja que indica la duración de la detención (ej: "5m").
    *   Al hacer clic en el marcador, se muestra un popup con la hora exacta y la duración precisa.

### Verificación:
La aplicación se está ejecutando y he verificado visualmente:
*   La nueva columna en la tabla de historial.
*   Que el sistema compila correctamente y la lógica de detección se aplica tanto al mapa como a la lista.
