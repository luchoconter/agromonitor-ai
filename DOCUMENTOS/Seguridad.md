# Auditoría de Seguridad - AgroMonitor v2.18

**Fecha del Informe:** 19/12/2025
**Nivel de Riesgo Actual:** 🔴 CRÍTICO
**Auditor:** AgroMonitor AI System

Este documento detalla el análisis de seguridad de la aplicación actual. El objetivo es identificar vulnerabilidades que podrían comprometer los datos del negocio o la privacidad de los usuarios antes de un despliegue en producción masiva.

---

## 1. Hallazgos Críticos (Vulnerabilidades de Alto Riesgo)

### A. Sistema de Autenticación "Custom" (Inseguro)
*   **Ubicación:** `services/repositories/authRepository.ts`
*   **El Problema:** La aplicación gestiona el inicio de sesión buscando manualmente un documento en una colección pública llamada `users` y comparando la contraseña **en el código del cliente** (`if (userData.password !== password)`).
*   **Por qué es grave:**
    1.  **Exposición de Contraseñas:** Las contraseñas se almacenan (probablemente en texto plano) en la base de datos. Si un atacante lee la colección `users`, obtiene acceso a **todas** las cuentas.
    2.  **Sin Protección Estándar:** No se utiliza hash (bcrypt/argon2), ni salting, ni protección contra ataques de fuerza bruta, ni gestión de tokens seguros (JWT).
    3.  **Persistencia Insegura:** La sesión se guarda como un objeto JSON plano en `localStorage`. Cualquier script malicioso (XSS) en el navegador puede robar la sesión completa clonando ese objeto.

### B. Aislamiento de Datos / Multi-Tenancy (Filtrado Cosmético)
*   **Ubicación:** `services/syncService.ts` y Hooks de datos.
*   **El Problema:** La separación de datos entre diferentes empresas (Empresa A vs Empresa B) se realiza mediante filtros `where('ownerId', '==', ...)` en el **Frontend**.
*   **Por qué es grave:**
    1.  **Seguridad por Oscuridad:** Firestore no sabe que el usuario "Juan" solo debe ver la empresa "AgroSur". Firestore entrega cualquier documento que se le pida si las Reglas de Seguridad están abiertas (lo cual es necesario actualmente para que funcione el login custom).
    2.  **Fuga de Datos:** Un usuario con conocimientos técnicos básicos puede abrir la consola del navegador e inyectar una consulta para descargar toda la base de datos de todos los clientes, ya que no hay una regla `request.auth.uid == resource.data.ownerId` que lo impida en el servidor.

---

## 2. Hallazgos de Riesgo Medio

### A. Exposición de API Keys (Gemini AI)
*   **Ubicación:** `services/geminiService.ts`
*   **El Problema:** Se utiliza `import.meta.env.VITE_API_KEY` directamente en el código del cliente para instanciar `GoogleGenAI`.
*   **Riesgo:** En una aplicación Vite/React, las variables de entorno se empaquetan en el código JavaScript final. Un usuario malintencionado puede extraer tu API Key y usarla en sus propios proyectos, consumiendo tu cuota de facturación de Google Cloud.
*   **Actualización v2.10:** Se migró de `process.env.API_KEY` (Node.js) a `import.meta.env.VITE_API_KEY` (estándar Vite), pero el riesgo de exposición persiste.
*   **Mitigación Temporal:** Configurar restricciones de dominio en Google Cloud Console para limitar el uso de la API key solo a `agromonitor-f959f.web.app` y establecer cuotas diarias.

### B. Validación de Datos (Integridad)
*   **El Problema:** La validación de tipos y campos obligatorios ocurre solo en los formularios de React.
*   **Riesgo:** Un atacante podría enviar datos corruptos o mal formados directamente a la API de Firestore, rompiendo la aplicación para otros usuarios o inyectando scripts en campos de texto (Stored XSS).

---

## 3. Plan de Remediación (Roadmap de Seguridad)

Para llevar la aplicación a un nivel profesional y seguro, se deben ejecutar los siguientes pasos **antes** de comercializar el software:

### Fase 1: Migración a Firebase Authentication (Prioridad 1)
Dejar de usar la colección `users` como mecanismo de login.
1.  Habilitar **Email/Password Auth** en la consola de Firebase.
2.  Refactorizar `authRepository.ts` para usar `signInWithEmailAndPassword` del SDK de Firebase.
3.  Migrar usuarios actuales al sistema de Auth de Firebase.
4.  Usar la colección `users` en Firestore **solo** para guardar datos del perfil (Nombre, Rol, ID de Empresa), no credenciales.

### Fase 2: Implementación de Firestore Security Rules (Prioridad 1)
Una vez que Auth funciona, cerrar la base de datos a nivel servidor.
Crear un archivo `firestore.rules`:
```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    // Función: El usuario es dueño del dato o pertenece a la empresa dueña
    function isAuthorized(docData) {
      return request.auth != null && (
        request.auth.uid == docData.ownerId || 
        request.auth.uid == docData.userId
      );
    }

    match /monitorings/{docId} {
      allow read, write: if isAuthorized(resource.data);
    }
    // ... aplicar a todas las colecciones
  }
}
```

### Fase 3: Protección de Infraestructura (Prioridad 2)
1.  **Backend Proxy para IA:** Mover las llamadas a Gemini a una **Firebase Cloud Function**. El frontend pide el análisis a la Cloud Function, y la Cloud Function (en entorno seguro) llama a Gemini usando la API Key secreta.
2.  **App Check:** Habilitar Firebase App Check para asegurar que las peticiones vengan solo de tu dominio web legítimo.

---

## 4. Notas de Deployment (v2.10)

### Configuración Actual de Producción
*   **Hosting:** Firebase Hosting (agromonitor-f959f.web.app)
*   **Variables de Entorno:** Archivo `.env` con `VITE_API_KEY` (opcional, para IA)
*   **PWA:** Service Worker activo con precaching de 3.26 MB de assets
*   **Build Size:** Bundle principal ~2.69 MB (gzip: ~746 KB)

### Recomendaciones Adicionales para Producción
1.  **Monitorear Uso de API Key:** Revisar semanalmente el consumo de Gemini API en Google Cloud Console.
2.  **Backup Regular:** Exportar datos de Firestore mensualmente como respaldo.
3.  **Logs de Acceso:** Implementar tracking básico de sesiones para detectar actividad sospechosa.
4.  **Rate Limiting:** Configurar Cloud Functions con límites de ejecución para prevenir ataques de denegación de servicio.

### Checklist Pre-Comercialización
- [ ] Migrar a Firebase Authentication (Fase 1)
- [ ] Implementar Firestore Security Rules (Fase 2)
- [ ] Mover API keys a Cloud Functions (Fase 3)
- [ ] Habilitar Firebase App Check
- [ ] Implementar sistema de backup automatizado
- [ ] Configurar alertas de seguridad en Firebase Console
- [ ] Documentar políticas de privacidad y términos de servicio

---

**Conclusión:**
La aplicación es funcionalmente excelente y ahora está desplegada en producción (v2.10), pero arquitectónicamente vulnerable. Se recomienda **no comercializar** hasta completar al menos la **Fase 1 y 2** del plan de remediación. El sistema offline está robusto y la PWA funciona correctamente, pero la seguridad de datos debe ser prioritaria antes de escalar.