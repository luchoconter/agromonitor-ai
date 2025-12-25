
# Arquitectura de Base de Datos (Firebase Firestore)

**Modelo: SaaS Multi-Tenant (Consultora)**
Aislamiento por `ownerId`.

## 1. Nivel de Identidad (`users`)
```json
{
  "uid": "...",
  "email": "...",
  "role": "admin" | "operator" | "company",
  "linkedAdminId": "...", 
  "linkedCompanyId": "..."
}
```

## 2. Nivel Estructural
*   `companies`, `fields`, `plots`, `seasons`
    *   **Integridad:** El borrado de estos elementos utiliza un servicio dedicado (`DeepDeleteService`) que realiza una limpieza recursiva de datos y archivos (Storage).
    *   **Seguridad:** La ejecución del borrado estructural requiere la validación de la contraseña del usuario actual en el frontend.
*   `assignments` (Asignación de cultivo a lote por campaña)
    ```json
    { "plotId": "...", "seasonId": "...", "cropId": "...", "ownerId": "..." }
    ```

## 3. Catálogos Privados
*   `crops`, `pests`, `agrochemicals`, `tasks`

## 4. Nivel Operativo

### `monitorings`
```json
{
  "id": "uuid",
  "companyId": "...", "fieldId": "...", "plotId": "...", "seasonId": "...",
  "userId": "...", "userName": "Juan Perez", // Trazabilidad
  "pestData": [...],
  "location": { "lat": -34.0, "lng": -60.0 }, // Nullable
  "weather": { // Nullable - Datos climáticos al momento de la muestra
     "temp": 24.5,
     "humidity": 60,
     "windSpeed": 12,
     "condition": "Parcialmente Nublado",
     "rainProb": 0
  },
  "media": { "photoUrl": "...", "audioUrl": "..." } // Nullable
}
```

### `lot_summaries`
Cierre de lote y feedback.
```json
{
  "status": "verde",
  "notes": "...",
  "isReviewed": true,
  "engineerStatus": "rojo",
  "engineerNotes": "Aplicar urgente...",
  "engineerAudioUrl": "..."
}
```

### `prescriptions` (Recetas Agronómicas)
```json
{
  "id": "uuid",
  "date": "ISO String",
  "companyId": "...", "fieldId": "...",
  "plotIds": ["id1", "id2"],
  "plotNames": ["Lote 1", "Lote 2"], // Snapshot para visualización rápida
  "items": [
    { "supplyId": "...", "supplyName": "Glifosato", "dose": "2.5", "unit": "Lt/Ha" }
  ],
  "taskIds": ["..."],
  "taskNames": ["Pulverización"],
  "notes": "...",
  "audioUrl": "...",
  "ownerId": "...",
  "status": "active" | "archived",
  
  // MAPA DE EJECUCIÓN: Estado individual por lote
  "executionData": {
      "plotId_1": {
          "executed": true,
          "executedAt": "ISO Date",
          "executedBy": "Nombre Usuario",
          "observation": "Se aplicó con viento norte"
      }
  }
}
```

### `prescriptionTemplates` (Plantillas de Recetas)
```json
{
  "id": "uuid",
  "name": "Barbecho Soja",
  "items": [...],
  "taskIds": [...],
  "notes": "...",
  "ownerId": "..."
}
```

## 5. Storage (Archivos)
Gestión de archivos binarios (imágenes y audio).

*   **Rutas:**
    *   `/monitoring-photos/{companyId}/{fieldId}/{plotId}/{fecha}.jpg`
    *   `/monitoring-audios/{companyId}/{fieldId}/{plotId}/{fecha}.webm`
    *   `/prescriptions-audio/...`
    *   `/lot-summaries-feedback/...`
    *   `/catalog-pests/{ownerId}/{filename}.jpg` (Imágenes de referencia de plagas)

*   **Estrategia de Limpieza (Garbage Collection):**
    *   La aplicación implementa lógica de limpieza en el servicio `deepDeleteService` y en los repositorios individuales (`catalogRepository`).
    *   Al eliminar un registro de la base de datos (ej: un Monitoreo o una Plaga), se dispara automáticamente el borrado del archivo físico en Storage para evitar costos innecesarios.
    *   Las carpetas vacías en Storage se eliminan virtualmente de forma automática.
