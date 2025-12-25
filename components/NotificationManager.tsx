
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useData } from '../contexts/DataContext';
import { NOTIFICATION_SOUND_BASE64 } from '../assets/notificationSound';

export const NotificationManager: React.FC = () => {
  const { currentUser } = useAuth();
  const { showNotification } = useUI();
  const { data } = useData();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Set para rastrear IDs ya notificados y evitar duplicados en re-renders
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  
  // Timestamp de inicio de sesión para ignorar eventos pasados
  const startTimeRef = useRef(new Date());

  useEffect(() => {
    // Precargar audio
    audioRef.current = new Audio(NOTIFICATION_SOUND_BASE64);
  }, []);

  useEffect(() => {
    // Solo el Admin/Ingeniero recibe notificaciones
    if (!currentUser || currentUser.role !== 'admin') return;

    // Iteramos sobre los resúmenes cargados en el contexto
    data.lotSummaries.forEach(summary => {
        // 1. Chequear si ya fue notificado en esta sesión
        if (notifiedIdsRef.current.has(summary.id)) return;

        // 2. Chequear fecha: solo notificar cosas creadas DESPUÉS de abrir la app
        // (Agregamos un pequeño buffer de 2 segundos para evitar race conditions en carga inicial)
        const summaryDate = new Date(summary.date);
        if (summaryDate.getTime() <= (startTimeRef.current.getTime() + 2000)) return;

        // 3. Chequear autoría: no notificar mis propias acciones
        if (summary.userId === currentUser.id) return;

        // --- ES UN NUEVO EVENTO ---
        
        // Marcar como notificado
        notifiedIdsRef.current.add(summary.id);
        
        // Reproducir Sonido
        if (audioRef.current) {
            audioRef.current.play().catch(e => console.warn("Audio play blocked by browser policy", e));
        }

        // Resolver Nombres para el mensaje
        const plotName = data.plots.find(p => p.id === summary.plotId)?.name || 'Lote desconocido';
        const userName = summary.userName || 'Un operario';
        
        // Icono según estado
        let icon = '';
        if (summary.status === 'verde') icon = '🟢';
        if (summary.status === 'amarillo') icon = '🟡';
        if (summary.status === 'rojo') icon = '🔴';

        // Mostrar Notificación Visual
        showNotification(
            `${icon} ${userName} finalizó: ${plotName}`, 
            summary.status === 'rojo' ? 'error' : (summary.status === 'amarillo' ? 'warning' : 'success')
        );
    });

  }, [data.lotSummaries, currentUser, data.plots, showNotification]);

  return null; // Componente lógico, no renderiza nada visual
};
