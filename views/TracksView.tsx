import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import * as Storage from '../services/storageService';
import { TrackSession } from '../types/tracking';
import { calculateStops } from '../services/trackingService';
import { Trash2, Map, Search, AlertTriangle, Loader2, PauseCircle, Eye, Upload } from 'lucide-react';
import { parseGpxAndCreateSession } from '../utils/gpxParser';
import { Modal, Button } from '../components/UI';
import { MapSection } from '../components/dashboard/MapSection';

export const TracksView: React.FC = () => {
    const { data } = useData();
    const { currentUser } = useAuth();
    const [tracks, setTracks] = useState<TrackSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTrack, setSelectedTrack] = useState<TrackSession | null>(null);
    const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [pendingImportTrack, setPendingImportTrack] = useState<TrackSession | null>(null);
    const [importData, setImportData] = useState({
        name: '',
        notes: '',
        companyId: '',
        fieldIds: [] as string[]
    });

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

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset input value to allow selecting the same file again if needed
        event.target.value = '';

        if (!currentUser) {
            alert("Debes estar logueado para importar.");
            return;
        }

        setIsLoading(true);
        try {
            const trackSession = await parseGpxAndCreateSession(file, {
                id: currentUser.id,
                name: currentUser.name || currentUser.email || 'Desconocido',
                email: currentUser.email || ''
            });

            setPendingImportTrack(trackSession);
            setImportData({
                name: trackSession.name || '',
                notes: trackSession.notes || '',
                companyId: '',
                fieldIds: []
            });
            setIsImportModalOpen(true);

        } catch (error) {
            console.error("Error importing GPX", error);
            alert("Error al importar archivo GPX: " + (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!pendingImportTrack) return;
        if (!importData.companyId) {
            alert("Por favor selecciona una empresa.");
            return;
        }

        setIsLoading(true);
        try {
            const finalTrack = {
                ...pendingImportTrack,
                name: importData.name,
                notes: importData.notes,
                companyId: importData.companyId,
                fieldIds: importData.fieldIds,
                synced: true // Mark as synced since it came from external and straight to DB
            };

            const newId = await Storage.saveTrack(finalTrack);
            finalTrack.id = newId;

            setTracks(prev => [finalTrack, ...prev]);

            setIsImportModalOpen(false);
            setPendingImportTrack(null);
            alert("Ruta importada correctamente.");
        } catch (error) {
            console.error("Error saving track", error);
            alert("Error al guardar la ruta importada.");
        } finally {
            setIsLoading(false);
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
            {/* Header Responsive */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <Map className="w-6 h-6 text-agro-600" />
                    Historial de Rutas GPS
                </h2>
                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-agro-500 outline-none w-full md:w-64"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <input
                        type="file"
                        accept=".gpx"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        onClick={handleImportClick}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium w-full md:w-auto"
                    >
                        <Upload className="w-4 h-4" />
                        Importar GPX
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-agro-600" /></div>
            ) : (
                <>
                    {/* MOBILE VIEW cards */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {filteredTracks.map(track => {
                            const companyName = data.companies.find(c => c.id === track.companyId)?.name || 'Empresa desc.';
                            const fieldNames = track.fieldIds?.map(fid => data.fields.find(f => f.id === fid)?.name).join(', ') || 'Campo desc.';
                            const stops = calculateStops(track.points || []).length;

                            return (
                                <div key={track.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 space-y-3">
                                    {/* Header Row: Date & Actions */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white">{new Date(track.startTime).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{new Date(track.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedTrack(track)}
                                                className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg border border-blue-100 dark:border-blue-900/30"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {currentUser?.role === 'admin' && (
                                                <button
                                                    onClick={() => setTrackToDelete(track.id)}
                                                    className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg border border-red-100 dark:border-red-900/30"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Content Info */}
                                    <div className="pl-2 border-l-2 border-agro-500">
                                        <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{companyName}</div>
                                        <div className="text-xs text-gray-500">{fieldNames}</div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                                        <div className="text-center">
                                            <span className="block text-[10px] text-gray-500 uppercase">Distancia</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-white">{track.distance.toFixed(2)} km</span>
                                        </div>
                                        <div className="text-center border-l border-gray-200 dark:border-gray-700">
                                            <span className="block text-[10px] text-gray-500 uppercase">Duración</span>
                                            <span className="font-mono font-bold text-gray-800 dark:text-white text-xs">{formatDuration(track.startTime, track.endTime)}</span>
                                        </div>
                                        <div className="text-center border-l border-gray-200 dark:border-gray-700">
                                            <span className="block text-[10px] text-gray-500 uppercase">Paradas</span>
                                            <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{stops}</span>
                                        </div>
                                    </div>

                                    {/* Footer: User & Notes */}
                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-600 dark:text-gray-300">
                                                {track.userName?.charAt(0)}
                                            </div>
                                            <span className="text-gray-600 dark:text-gray-400">{track.userName}</span>
                                        </div>
                                        {track.name && (
                                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{track.name}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {filteredTracks.length === 0 && (
                            <div className="text-center py-10 text-gray-400 italic bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                No hay rutas registradas.
                            </div>
                        )}
                    </div>

                    {/* DESKTOP VIEW Table */}
                    <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-semibold uppercase text-xs">
                                <tr>
                                    <th className="px-4 py-3 whitespace-nowrap">Fecha / Hora</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Ubicación</th>
                                    <th className="px-4 py-3 whitespace-nowrap">Usuario</th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap">Duración</th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap">Distancia</th>
                                    <th className="px-4 py-3 text-center whitespace-nowrap">Detenciones</th>
                                    <th className="px-4 py-3 w-1/3">Detalle</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
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
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1 text-orange-600 dark:text-orange-400">
                                                    <PauseCircle className="w-4 h-4" />
                                                    <span className="font-mono font-bold">{calculateStops(track.points || []).length}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {track.name && <div className="font-bold text-gray-800 dark:text-gray-200">{track.name}</div>}
                                                {track.notes ? (
                                                    <div className="text-xs text-gray-500 italic truncate max-w-[300px]" title={track.notes}>{track.notes}</div>
                                                ) : <span className="text-xs text-gray-400">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setSelectedTrack(track)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                        title="Ver en mapa"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    {currentUser?.role === 'admin' && (
                                                        <button
                                                            onClick={() => setTrackToDelete(track.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Eliminar Ruta"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
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
                </>
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

            {/* View Track Map Modal */}
            <Modal isOpen={!!selectedTrack} onClose={() => setSelectedTrack(null)} title="Visualizar Recorrido" size="xl">
                <div className="h-[60vh] w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                    {selectedTrack && (
                        <MapSection
                            monitorings={[]}
                            plots={[]}
                            tracks={[selectedTrack]}
                            showTracks={true}
                            isVisible={true}
                        />
                    )}
                </div>
                <div className="mt-4 flex justify-end">
                    <Button onClick={() => setSelectedTrack(null)}>Cerrar</Button>
                </div>
            </Modal>

            {/* Import Modal */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Ruta GPX">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Ruta</label>
                        <input
                            type="text"
                            value={importData.name}
                            onChange={(e) => setImportData({ ...importData, name: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-agro-500 focus:ring-agro-500 dark:bg-gray-700 sm:text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Empresa</label>
                        <select
                            value={importData.companyId}
                            onChange={(e) => setImportData({ ...importData, companyId: e.target.value, fieldIds: [] })}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-agro-500 focus:ring-agro-500 dark:bg-gray-700 sm:text-sm"
                        >
                            <option value="">Selecciona una empresa</option>
                            {data.companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {importData.companyId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campos (Lotes)</label>
                            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-900/50">
                                {data.fields
                                    .filter(f => f.companyId === importData.companyId)
                                    .map(field => (
                                        <div key={field.id} className="flex items-center gap-2 mb-1">
                                            <input
                                                type="checkbox"
                                                id={`field-${field.id}`}
                                                checked={importData.fieldIds.includes(field.id)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setImportData(prev => ({
                                                        ...prev,
                                                        fieldIds: checked
                                                            ? [...prev.fieldIds, field.id]
                                                            : prev.fieldIds.filter(id => id !== field.id)
                                                    }));
                                                }}
                                                className="rounded border-gray-300 text-agro-600 focus:ring-agro-500"
                                            />
                                            <label htmlFor={`field-${field.id}`} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                                {field.name}
                                            </label>
                                        </div>
                                    ))}
                                {data.fields.filter(f => f.companyId === importData.companyId).length === 0 && (
                                    <p className="text-sm text-gray-500 italic">No hay campos disponibles.</p>
                                )}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones</label>
                        <textarea
                            value={importData.notes}
                            onChange={(e) => setImportData({ ...importData, notes: e.target.value })}
                            rows={3}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-agro-500 focus:ring-agro-500 dark:bg-gray-700 sm:text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmImport} disabled={!importData.companyId}>Confirmar Importación</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
