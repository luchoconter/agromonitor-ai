
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, Edit2, Trash2, Map as MapIcon, List, Play, Pause, Image as ImageIcon, FileSpreadsheet, User, Layers, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button, Select, Modal } from '../components/UI';
import * as Storage from '../services/storageService';
import * as Export from '../services/exportService';
import * as Import from '../services/importService';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useOfflineMedia } from '../hooks/useOfflineMedia';

const DATE_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
    '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'
];

export const HistoryView: React.FC = () => {
    const { currentUser } = useAuth();
    const { data, userCompanies, dataOwnerId, dataOwnerName } = useData();
    const { setView, setEditingMonitoringId, setSelection, showNotification, selection } = useUI();

    if (!currentUser) return null;

    const [isMapView, setIsMapView] = useState(false);
    const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');

    // Delete Modal State
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Import State
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<any | null>(null);

    const [historyFilter, setHistoryFilter] = useState(() => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const formatDateInput = (date: Date) => date.toISOString().split('T')[0];
        return {
            companyId: '', fieldId: '', plotId: '', userId: currentUser.role === 'operator' ? currentUser.id : '', searchTerm: '',
            dateFrom: formatDateInput(yesterday), dateTo: formatDateInput(today)
        };
    });

    useEffect(() => {
        if (selection.dateReference) {
            setHistoryFilter(prev => ({
                ...prev,
                companyId: selection.companyId || '',
                fieldId: selection.fieldId || '',
                plotId: selection.plotId || '',
                dateFrom: selection.dateReference || '',
                dateTo: selection.dateReference || ''
            }));
            setSelection({ ...selection, dateReference: undefined });
        }
    }, [selection]);

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const toggleAudio = (url: string, id: string) => {
        if (playingAudioId === id) {
            if (audioPlayerRef.current) { audioPlayerRef.current.pause(); audioPlayerRef.current = null; }
            setPlayingAudioId(null);
        } else {
            if (audioPlayerRef.current) { audioPlayerRef.current.pause(); }
            const audio = new Audio(url);
            audio.onended = () => setPlayingAudioId(null);
            audio.play().catch(err => console.error("Error playing audio:", err));
            audioPlayerRef.current = audio;
            setPlayingAudioId(id);
        }
    };

    useEffect(() => { return () => { if (audioPlayerRef.current) audioPlayerRef.current.pause(); }; }, []);

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const getShortDate = (isoString: string) => {
        const date = new Date(isoString);
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    const historyFields = useMemo(() => data.fields.filter(f => f.companyId === historyFilter.companyId), [data.fields, historyFilter.companyId]);
    const historyPlots = useMemo(() => data.plots.filter(p => p.fieldId === historyFilter.fieldId), [data.plots, historyFilter.fieldId]);

    const historyUsers = useMemo(() => {
        const usersMap = new Map<string, string>();
        data.monitorings.forEach(m => {
            if (m.userId && m.userName) {
                usersMap.set(m.userId, m.userName);
            }
        });
        return Array.from(usersMap.entries())
            .map(([id, name]) => ({ value: id, label: name }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
    }, [data.monitorings]);

    const filteredHistoryBase = useMemo(() => {
        const result = data.monitorings.filter(m => {
            if (historyFilter.companyId && m.companyId !== historyFilter.companyId) return false;
            if (historyFilter.fieldId && m.fieldId !== historyFilter.fieldId) return false;
            if (historyFilter.plotId && m.plotId !== historyFilter.plotId) return false;
            if (historyFilter.userId && m.userId !== historyFilter.userId) return false;

            if (historyFilter.dateFrom) {
                const mDate = new Date(m.date).setHours(0, 0, 0, 0);
                const fParts = historyFilter.dateFrom.split('-');
                const fDate = new Date(Number(fParts[0]), Number(fParts[1]) - 1, Number(fParts[2])).getTime();
                if (mDate < fDate) return false;
            }
            if (historyFilter.dateTo) {
                const mDate = new Date(m.date).setHours(0, 0, 0, 0);
                const tParts = historyFilter.dateTo.split('-');
                const tDate = new Date(Number(tParts[0]), Number(tParts[1]) - 1, Number(tParts[2])).getTime();
                if (mDate > tDate) return false;
            }
            if (historyFilter.searchTerm) {
                const term = historyFilter.searchTerm.toLowerCase();
                const obsMatch = m.observations?.toLowerCase().includes(term);
                const plotName = data.plots.find(p => p.id === m.plotId)?.name.toLowerCase().includes(term);
                const pestNames = (m.pestData || []).map(p => p.name.toLowerCase()).join(' ');
                return obsMatch || plotName || pestNames.includes(term);
            }
            return true;
        });
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [data.monitorings, historyFilter, data.plots]);

    // Enriquecer con multimedia offline si existe
    const filteredHistory = useOfflineMedia(filteredHistoryBase);

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await Storage.deleteMonitoring(deleteId);
            showNotification("Monitoreo eliminado.", "success");
            setDeleteId(null);
        }
    };

    const handleEdit = (record: any) => {
        setEditingMonitoringId(record.id);
        setSelection({ companyId: record.companyId, fieldId: record.fieldId, plotId: record.plotId, seasonId: record.seasonId });
        setView('home');
    };

    const handleExportExcel = () => {
        const exportData = filteredHistory.map(m => {
            const company = data.companies.find(c => c.id === m.companyId)?.name || 'Desconocida';
            const field = data.fields.find(f => f.id === m.fieldId)?.name || 'Desconocido';
            const plot = data.plots.find(p => p.id === m.plotId)?.name || 'Desconocido';
            const pestSummary = (m.pestData || []).map(p => `${p.name} (${p.value} ${p.unit})`).join('; ');
            return {
                Fecha: formatDate(m.date),
                Usuario: m.userName || 'Usuario',
                Empresa: company,
                Campo: field,
                Lote: plot,
                Muestra: `M${m.sampleNumber || 1}`,
                Plagas: pestSummary,
                Observaciones: m.observations || '',
                Latitud: m.location?.lat || '',
                Longitud: m.location?.lng || '',
            };
        });
        Export.downloadExcel(exportData, `Monitoreos_${new Date().toISOString().split('T')[0]}`);
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !dataOwnerId) return;

        setIsImporting(true);
        try {
            const result = await Import.processExcelMonitoringImport(file, dataOwnerId, dataOwnerName || 'Admin');
            setImportResult(result);
            showNotification(`Importación completada: ${result.success} registros cargados.`, "success");
        } catch (err) {
            console.error(err);
            showNotification("Error crítico durante la importación", "error");
        } finally {
            setIsImporting(false);
            e.target.value = ''; // Reset input
        }
    };

    // --- MAP COMPONENT LOGIC ---
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);
    const legendControlRef = useRef<any>(null);

    const destroyMap = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.off();
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            legendControlRef.current = null;
            tileLayerRef.current = null;
        }
    };

    useEffect(() => { return () => destroyMap(); }, []);
    useEffect(() => { if (!isMapView) destroyMap(); }, [isMapView]);

    useEffect(() => {
        if (!isMapView || !mapContainerRef.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current).setView([-34.6037, -58.3816], 5);
        }
        const map = mapInstanceRef.current;

        if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
        const tileUrl = mapType === 'satellite'
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

        const attribution = mapType === 'satellite'
            ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

        tileLayerRef.current = L.tileLayer(tileUrl, { attribution }).addTo(map);
        map.eachLayer((layer: any) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
        if (legendControlRef.current) { map.removeControl(legendControlRef.current); legendControlRef.current = null; }

        const uniqueDates = Array.from(new Set(filteredHistory.filter(m => m.location).map(m => getShortDate(m.date)))).sort();
        const dateColorMap: Record<string, string> = {};
        uniqueDates.forEach((d: string, i: number) => { dateColorMap[d] = DATE_COLORS[i % DATE_COLORS.length]; });

        const markers: any[] = [];
        filteredHistory.forEach(m => {
            if (m.location) {
                const plotName = data.plots.find(p => p.id === m.plotId)?.name || 'Lote';
                const color = dateColorMap[getShortDate(m.date)] || '#3b82f6';
                const markerHtml = `<div style="background-color: ${color}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`;
                const customIcon = L.divIcon({ className: 'custom-map-marker', html: markerHtml, iconSize: [18, 18], iconAnchor: [9, 9] });
                const marker = L.marker([m.location.lat, m.location.lng], { icon: customIcon }).addTo(map).bindPopup(`<b>${plotName}</b><br/>${formatDate(m.date)}<br/><span style="font-size:10px;color:#666">${m.userName || 'Usuario'}</span>`);
                markers.push(marker);
            }
        });

        if (uniqueDates.length > 0) {
            const LegendControl = L.Control.extend({
                options: { position: 'bottomright' },
                onAdd: function () {
                    const div = L.DomUtil.create('div', 'bg-white p-2 rounded shadow text-xs text-gray-900');
                    div.innerHTML = '<strong>Fechas</strong><br>';
                    uniqueDates.forEach((date: string) => {
                        const color = dateColorMap[date];
                        div.innerHTML += `<div style="display: flex; align-items: center; margin-top: 4px;"><span style="background:${color}; width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 5px;"></span>${date}</div>`;
                    });
                    return div;
                }
            });
            legendControlRef.current = new LegendControl();
            map.addControl(legendControlRef.current);
        }

        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

        setTimeout(() => { if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize(); }, 200);
    }, [isMapView, filteredHistory, mapType]);

    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 shrink-0">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Historial de Muestreos</h2>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* IMPORT BUTTON - Hide on very small screens or make icon only? Keeping full for now but wrapping */}
                    <label className={`px-3 py-1.5 h-auto text-xs font-bold rounded-lg border border-agro-200 dark:border-agro-800 bg-agro-50 dark:bg-agro-900/30 text-agro-700 dark:text-agro-400 cursor-pointer hover:bg-agro-100 transition-colors flex items-center justify-center flex-1 md:flex-none ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isImporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                        <span className="hidden sm:inline">IMPORTAR</span><span className="sm:hidden">IMPORTAR</span>
                        <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="hidden" disabled={isImporting} />
                    </label>

                    <Button variant="secondary" onClick={handleExportExcel} className="px-3 py-1.5 h-auto text-xs font-bold flex items-center justify-center flex-1 md:flex-none" disabled={filteredHistory.length === 0}>
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> <span className="hidden sm:inline">EXPORTAR</span><span className="sm:hidden">EXP</span>
                    </Button>

                    <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg flex-1 md:flex-none justify-center">
                        <button onClick={() => setIsMapView(false)} className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${!isMapView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}><List className="w-3 h-3 mr-1.5" /> LISTADO</button>
                        <button onClick={() => setIsMapView(true)} className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center ${isMapView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}><MapIcon className="w-3 h-3 mr-1.5" /> MAPA</button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4 shrink-0">
                <div className="mb-2 flex gap-2 w-full">
                    <div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase ml-1 mb-0.5">Desde</label><input type="date" className="w-full px-2 py-1.5 rounded text-xs border bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200" value={historyFilter.dateFrom} onChange={(e) => setHistoryFilter({ ...historyFilter, dateFrom: e.target.value })} /></div>
                    <div className="flex-1"><label className="block text-[10px] font-bold text-gray-400 uppercase ml-1 mb-0.5">Hasta</label><input type="date" className="w-full px-2 py-1.5 rounded text-xs border bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200" value={historyFilter.dateTo} onChange={(e) => setHistoryFilter({ ...historyFilter, dateTo: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <Select label="" options={userCompanies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={historyFilter.companyId} onChange={(e) => setHistoryFilter({ ...historyFilter, companyId: e.target.value, fieldId: '', plotId: '' })} placeholder="Todas las empresas" className="py-1 text-xs" />
                    <Select label="" options={historyFields.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={historyFilter.fieldId} onChange={(e) => setHistoryFilter({ ...historyFilter, fieldId: e.target.value, plotId: '' })} disabled={!historyFilter.companyId} placeholder="Todos los campos" className="py-1 text-xs" />
                    <Select label="" options={historyPlots.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(p => ({ value: p.id, label: p.name }))} value={historyFilter.plotId} onChange={(e) => setHistoryFilter({ ...historyFilter, plotId: e.target.value })} disabled={!historyFilter.fieldId} placeholder="Todos los lotes" className="py-1 text-xs" />
                    <Select label="" options={historyUsers} value={historyFilter.userId} onChange={(e) => setHistoryFilter({ ...historyFilter, userId: e.target.value })} placeholder="Todos los usuarios" className="py-1 text-xs" disabled={currentUser.role === 'operator'} />
                </div>
            </div>

            {isMapView ? (
                <div className="flex-1 relative bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 min-h-[400px]">
                    <div ref={mapContainerRef} className="w-full h-full z-0" />
                    <div className="absolute top-4 right-4 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                        <button onClick={() => setMapType(prev => prev === 'satellite' ? 'street' : 'satellite')} className="p-2 text-gray-700 dark:text-gray-300 hover:text-agro-600 dark:hover:text-agro-400 transition-colors" title={mapType === 'satellite' ? "Cambiar a Plano" : "Cambiar a Satélite"}><Layers className="w-5 h-5" /></button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 overflow-y-auto flex-1 pb-20">
                    {filteredHistory.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="italic">No se encontraron registros.</p>
                        </div>
                    ) : filteredHistory.map(m => (
                        <div key={m.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative group">
                            <div className="flex justify-between items-start mb-1 border-b border-gray-100 dark:border-gray-700 pb-2 pr-16">
                                <div className="font-bold text-gray-800 dark:text-gray-200 text-sm">M{m.sampleNumber} / {data.plots.find(p => p.id === m.plotId)?.name} / {data.fields.find(f => f.id === m.fieldId)?.name} / {data.companies.find(c => c.id === m.companyId)?.name}</div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatDate(m.date)}</div>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center justify-end"><User className="w-3 h-3 mr-1" /> {m.userName || 'Usuario'}</div>
                                </div>
                            </div>
                            <div className="flex gap-4 mb-2 mt-1">
                                {m.phenology && (
                                    <div className="flex items-center text-xs">
                                        <span className={`px-2 py-0.5 rounded font-bold border ${m.phenology.startsWith('V') ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800' :
                                            m.phenology.startsWith('R') ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' :
                                                'bg-gray-50 text-gray-600 border-gray-200'
                                            }`}>
                                            {m.phenology}
                                        </span>
                                    </div>
                                )}
                                {m.standData && m.standData.plantsPerHectare > 0 && (
                                    <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                        <span className="font-bold mr-1">{m.standData.plantsPerHectare.toLocaleString()}</span> pl/Ha
                                    </div>
                                )}
                            </div>

                            {m.pestData && m.pestData.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {m.pestData.map((pd, idx) => (<div key={idx} className="flex items-center text-sm"><span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span><span className="font-medium text-gray-700 dark:text-gray-300 mr-1">{pd.name}:</span><span className="text-gray-600 dark:text-gray-400">{pd.value} <span className="text-xs text-gray-400">({pd.unit})</span></span></div>))}
                                </div>
                            )}
                            {m.observations && <div className="text-sm mt-2 text-gray-700 dark:text-gray-300 italic border-l-2 border-gray-200 dark:border-gray-700 pl-2">"{m.observations}"</div>}

                            {m.media?.hasAudio && m.media?.audioUrl && (
                                <div onClick={(e) => { e.stopPropagation(); toggleAudio(m.media!.audioUrl!, m.id); }} className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border select-none ${playingAudioId === m.id ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700' : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600'}`}>
                                    {playingAudioId === m.id ? <Pause className="w-3 h-3 mr-1.5 fill-current" /> : <Play className="w-3 h-3 mr-1.5 fill-current" />}
                                    {playingAudioId === m.id ? 'Reproduciendo...' : `Escuchar (${m.media.audioDuration || '?'}s)`}
                                </div>
                            )}

                            {m.media?.photoUrl && (
                                <div onClick={(e) => { e.stopPropagation(); setPreviewImage(m.media!.photoUrl!); }} className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-90 transition-opacity">
                                    <img src={m.media.photoUrl} alt="Foto del monitoreo" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center">
                                        <ImageIcon className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            )}

                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                <button onClick={() => handleEdit(m)} className="p-1.5 text-gray-400 hover:text-agro-600 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={(e) => handleDeleteClick(e, m.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* --- IMAGE PREVIEW MODAL --- */}
            <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Imagen Adjunta">
                <div className="flex justify-center items-center bg-black/5 dark:bg-black/20 rounded-lg overflow-hidden min-h-[300px]">
                    {previewImage && <img src={previewImage} alt="Preview" className="max-w-full max-h-[70vh] object-contain rounded" />}
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={() => setPreviewImage(null)}>Cerrar</Button>
                </div>
            </Modal>

            {/* --- IMPORT RESULT MODAL --- */}
            <Modal isOpen={!!importResult} onClose={() => setImportResult(null)} title="Resultado de Importación">
                <div className="space-y-4">
                    <div className="flex items-center justify-center p-6 bg-green-50 dark:bg-green-900/20 rounded-full w-20 h-20 mx-auto">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">¡Proceso Finalizado!</h3>
                        <p className="text-sm text-gray-500 mt-1">Se procesaron {importResult?.total} filas del archivo.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-400 uppercase font-bold block">Exitosos</span>
                            <span className="text-xl font-bold text-green-600">{importResult?.success}</span>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                            <span className="text-xs text-gray-400 uppercase font-bold block">Con Error</span>
                            <span className="text-xl font-bold text-red-600">{importResult?.errors}</span>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Entidades Creadas Automáticamente:</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">Empresas: {importResult?.created.companies}</span>
                            <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">Campos: {importResult?.created.fields}</span>
                            <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs">Lotes: {importResult?.created.plots}</span>
                            <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs">Operarios: {importResult?.created.users}</span>
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        <Button onClick={() => setImportResult(null)}>Cerrar</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Monitoreo">
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">¿Estás seguro de eliminar este monitoreo? Esta acción no se puede deshacer.</p>
                    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button><Button variant="danger" onClick={confirmDelete}>Eliminar</Button></div>
                </div>
            </Modal>
        </div>
    );
};
