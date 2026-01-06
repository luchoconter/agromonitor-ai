He implementado la visualización de rutas GPS individuales en el mapa.

### Características agregadas:

*   **Botón "Ver en mapa"**: Se ha añadido un nuevo botón con un ícono de ojo en la columna de acciones de la tabla `Historial de Rutas GPS`.
    *   Este botón está disponible para **todos los usuarios** que tienen acceso a la tabla, no solo para administradores.
*   **Modal de Visualización**: Al hacer clic en el botón, se abre un modal de tamaño grande (`xl`) que muestra el mapa interactivo.
*   **Detalle del Recorrido**:
    *   Reutiliza el componente de mapa existente pero cargando exclusivamente la ruta seleccionada.
    *   Muestra el trazado de la ruta.
    *   Muestra los marcadores de **Inicio** y **Fin**.
    *   Muestra las **Detenciones** de más de 1 minuto con su duración.
    *   Ajusta automáticamente el zoom para encuadrar todo el recorrido.

### Verificación:

He probado la funcionalidad en el navegador:
1.  Abrí la sección de Rutas GPS.
2.  Hice clic en el ícono de ojo de una de las rutas.
3.  Confirmé que el mapa se abre correctamente, centrado en la ruta, y mostrando todos los detalles esperados.
