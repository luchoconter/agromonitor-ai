import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import * as Storage from '../services/storageService';
import { TrackSession } from '../types/tracking';
import { Trash2, Map, Search, AlertTriangle, Loader2 } from 'lucide-react';
import { Modal, Button } from '../components/UI';

export const TracksView: React.FC = () => {
    const { data } = useData();
    const { currentUser } = useAuth();
    const [tracks, setTracks] = useState<TrackSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [trackToDelete, setTrackToDelete] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        loadTracks();
    }, []);

    const loadTracks = async () => {
        setIsLoading(true);
        try {
            // Fetch all tracks initially
            const allTracks = await Storage.getTracks();
            setTracks(allTracks);
        } catch (error) {
            console.error("Error loading tracks", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!trackToDelete) return;
        try {
            await Storage.deleteTrack(trackToDelete);
            setTracks(prev => prev.filter(t => t.id !== trackToDelete));
            setTrackToDelete(null);
        } catch (error) {
            console.error("Error deleting track", error);
        }
    };

    const formatDuration = (start: string, end?: string) => {
        if (!end) return '-';
        const diff = new Date(end).getTime() - new Date(start).getTime();
        const seconds = Math.floor(diff / 1000);
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const filteredTracks = tracks.filter(t => {
        // Operator filter: can only see their own tracks
        if (currentUser?.role === 'operator' && t.userId !== currentUser.id) {
            return false;
        }

        const term = searchTerm.toLowerCase();
        return (
            (t.name?.toLowerCase().includes(term)) ||
            (t.userName?.toLowerCase().includes(term)) ||
            (t.notes?.toLowerCase().includes(term))
        );
    });

    return (
        <div className="max-w-7xl mx-auto pb-20">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Map className="w-6 h-6 text-agro-600" />
                    Historial de Rutas GPS
                </h2>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-agro-500 outline-none w-full sm:w-64"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-agro-600" /></div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 whitespace-nowrap">Fecha / Hora</th>
                                <th className="px-4 py-3 whitespace-nowrap">Ubicación</th>
                                <th className="px-4 py-3 whitespace-nowrap">Usuario</th>
                                <th className="px-4 py-3 text-center whitespace-nowrap">Duración</th>
                                <th className="px-4 py-3 text-center whitespace-nowrap">Distancia</th>
                                <th className="px-4 py-3 w-1/3">Detalle</th>
                                {currentUser?.role === 'admin' && <th className="px-4 py-3 text-right">Acciones</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                            {filteredTracks.map(track => {
                                const companyName = data.companies.find(c => c.id === track.companyId)?.name || 'Empresa desc.';
                                const fieldNames = track.fieldIds?.map(fid => data.fields.find(f => f.id === fid)?.name).join(', ') || 'Campo desc.';

                                return (
                                    <tr key={track.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-bold text-gray-900 dark:text-white">{new Date(track.startTime).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{new Date(track.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{companyName}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[150px]" title={fieldNames}>{fieldNames}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                    {track.userName?.charAt(0)}
                                                </div>
                                                <span className="text-gray-700 dark:text-gray-300">{track.userName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-mono">
                                                {formatDuration(track.startTime, track.endTime)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="font-mono font-bold">{track.distance.toFixed(2)} km</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {track.name && <div className="font-bold text-gray-800 dark:text-gray-200">{track.name}</div>}
                                            {track.notes ? (
                                                <div className="text-xs text-gray-500 italic truncate max-w-[300px]" title={track.notes}>{track.notes}</div>
                                            ) : <span className="text-xs text-gray-400">-</span>}
                                        </td>
                                        {currentUser?.role === 'admin' && (
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setTrackToDelete(track.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Eliminar Ruta"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredTracks.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-gray-400 italic">
                                        No se encontraron rutas registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={!!trackToDelete} onClose={() => setTrackToDelete(null)} title="Eliminar Ruta">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                        <AlertTriangle className="w-6 h-6 shrink-0" />
                        <p className="text-sm">¿Estás seguro de que deseas eliminar esta ruta permanentemente? Esta acción no se puede deshacer.</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setTrackToDelete(null)}>Cancelar</Button>
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">Eliminar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
