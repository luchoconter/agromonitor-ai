
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; 

// --- SERVICE WORKER REGISTRATION REMOVED ---
// La gestión del Service Worker ahora es manejada automáticamente por vite-plugin-pwa
// configurado en vite.config.ts. Esto evita conflictos de caché y estrategias duplicadas.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
