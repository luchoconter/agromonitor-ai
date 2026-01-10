import React, { useState } from 'react';
import { TrackSession } from '../../types/tracking';
import { User, Field } from '../../types';
import { X, Trash2, MapPin, User as UserIcon, Calendar, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { deleteTrack } from '../../services/repositories/trackRepository';
import { Modal, Button } from '../UI';

interface TrackListModalProps {
    isOpen: boolean;
    onClose: () => void;
    tracks: TrackSession[];
    users: User[];
    fields: Field[];
    onTrackDeleted: (trackId: string) => void;
}

export const TrackListModal: React.FC<TrackListModalProps> = ({ isOpen, onClose, tracks, users, fields, onTrackDeleted }) => {
    if (!isOpen) return null;

    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [trackToDelete, setTrackToDelete] = useState<string | null>(null);

    const handleDeleteClick = (trackId: string) => {
        setTrackToDelete(trackId);
    };

    const confirmDelete = async () => {
        if (!trackToDelete) return;
        setIsDeleting(trackToDelete);
        try {
            await deleteTrack(trackToDelete);
            onTrackDeleted(trackToDelete);
            setTrackToDelete(null);
        } catch (error) {
            console.error("Error deleting track:", error);
            // Optional: You might want to use a toast here if available, or just log for now
            // alert("Error al eliminar el recorrido."); // Avoid alert as per UX audit
        } finally {
            setIsDeleting(null);
        }
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (start: string, end?: string) => {
        if (!end) return '-';
        const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        return `${h}h ${m}m`;
    };

    const sortedTracks = [...tracks].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" style={{ zIndex: 1000 }}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-agro-600" />
                            Listado de Recorridos
                        </h2>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-0">
                        {sortedTracks.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                                No hay recorridos registrados en este período.
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Fecha / Usuario</th>
                                        <th className="px-4 py-3">Detalle</th>
                                        <th className="px-4 py-3">Campos</th>
                                        <th className="px-4 py-3 text-center">Duración</th>
                                        <th className="px-4 py-3 text-center">Distancia</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {sortedTracks.map(track => {
                                        const user = users.find(u => u.id === track.userId);
                                        const fieldNames = track.fieldIds?.map(fid => fields.find(f => f.id === fid)?.name).filter(Boolean).join(', ') || '-';

                                        return (
                                            <tr key={track.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                <td className="px-4 py-3 align-top">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                            {formatDate(track.startTime)}
                                                        </span>
                                                        <span className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                                                            <UserIcon className="w-3.5 h-3.5" />
                                                            {user?.name || track.userName || 'Desconocido'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="flex flex-col max-w-xs">
                                                        {track.name && (
                                                            <span className="font-medium text-purple-700 dark:text-purple-300 mb-0.5">
                                                                {track.name}
                                                            </span>
                                                        )}
                                                        {track.notes ? (
                                                            <span className="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-2" title={track.notes}>
                                                                {track.notes}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                        {fieldNames}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center align-top">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                        {formatDuration(track.startTime, track.endTime)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center align-top">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                                                        {track.distance.toFixed(2)} km
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right align-top">
                                                    <button
                                                        onClick={() => handleDeleteClick(track.id)}
                                                        disabled={isDeleting === track.id}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Eliminar Recorrido"
                                                    >
                                                        {isDeleting === track.id ? (
                                                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            <Modal
                isOpen={!!trackToDelete}
                onClose={() => setTrackToDelete(null)}
                title="Eliminar Recorrido"
                size="sm"
                zIndex={10001}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <p className="text-sm font-medium">Esta acción no se puede deshacer.</p>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                        ¿Estás seguro de que deseas eliminar este recorrido permanentemente?
                    </p>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setTrackToDelete(null)} disabled={!!isDeleting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="danger"
                            onClick={confirmDelete}
                            isLoading={!!isDeleting}
                        >
                            Eliminar
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
