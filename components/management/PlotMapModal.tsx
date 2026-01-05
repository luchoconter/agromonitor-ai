import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Select, Input } from '../UI';
import { Plot, Company, Field } from '../../types';
import { Map as MapIcon, Layers, Search, Check, X, Move } from 'lucide-react';

interface PlotMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    plots: Plot[];
    companies: Company[];
    fields: Field[];
    onUpdatePlot: (id: string, lat: number, lng: number) => Promise<void>;
}

export const PlotMapModal: React.FC<PlotMapModalProps> = ({ isOpen, onClose, plots, companies, fields, onUpdatePlot }) => {
    const mapDivRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);

    // State
    const [mapType, setMapType] = useState<'satellite' | 'street'>('satellite');
    const [filterCompanyId, setFilterCompanyId] = useState('');
    const [filterFieldId, setFilterFieldId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Mode State
    const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
    const [tempPos, setTempPos] = useState<{ lat: number, lng: number } | null>(null);

    // Derived Data
    const availableFields = fields.filter(f => !filterCompanyId || f.companyId === filterCompanyId);

    const filteredPlots = plots.filter(p => {
        if (!p.lat || !p.lng) return false;
        if (filterCompanyId) {
            const field = fields.find(f => f.id === p.fieldId);
            const cId = p.companyId || field?.companyId;
            if (cId !== filterCompanyId) return false;
        }
        if (filterFieldId && p.fieldId !== filterFieldId) return false;
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    // Initialize Map
    useEffect(() => {
        if (!isOpen) return;

        const L = (window as any).L;
        if (!L || !mapDivRef.current) return;

        if (!mapInstanceRef.current) {
            const map = L.map(mapDivRef.current, {
                zoomControl: false,
                attributionControl: false
            }).setView([-34.6037, -58.3816], 5);

            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersRef.current = [];
            }
        };
    }, [isOpen]);

    // Handle Tiles (Google Maps)
    useEffect(() => {
        const map = mapInstanceRef.current;
        const L = (window as any).L;
        if (!map || !L) return;

        map.eachLayer((layer: any) => {
            if (layer instanceof L.TileLayer) map.removeLayer(layer);
        });

        const url = mapType === 'street'
            ? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

        const attribution = mapType === 'street'
            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            : 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

        L.tileLayer(url, {
            maxZoom: 20,
            attribution
        }).addTo(map);
    }, [mapType, isOpen]);

    // Handle Markers
    useEffect(() => {
        const map = mapInstanceRef.current;
        const L = (window as any).L;
        if (!map || !L || !isOpen) return;

        // Clear markers
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const group = L.featureGroup();

        filteredPlots.forEach(plot => {
            // Determine styling
            const isEditing = editingPlotId === plot.id;
            const isDimmed = editingPlotId && !isEditing;

            const company = companies.find(c => c.id === plot.companyId) || (plot.fieldId ? companies.find(c => fields.find(f => f.id === plot.fieldId)?.companyId === c.id) : null);
            const field = fields.find(f => f.id === plot.fieldId);

            // Marker Icon
            const color = isEditing ? '#f59e0b' : '#3b82f6'; // Amber for editing, Blue for normal
            const zIndex = isEditing ? 1000 : 100;
            const markerHtml = `<div style="
                background-color: ${color}; 
                width: ${isEditing ? '18px' : '14px'}; 
                height: ${isEditing ? '18px' : '14px'}; 
                border-radius: 50%; 
                border: 2px solid white; 
                box-shadow: 0 0 4px rgba(0,0,0,0.4);
                ${isEditing ? 'animation: pulse 1.5s infinite;' : ''}
            "></div>`;

            if (isEditing) {
                const style = document.createElement('style');
                style.innerHTML = `@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }`;
                document.head.appendChild(style);
            }

            const customIcon = L.divIcon({
                className: 'custom-map-marker',
                html: markerHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([plot.lat!, plot.lng!], {
                icon: customIcon,
                draggable: isEditing,
                zIndexOffset: zIndex,
                opacity: isDimmed ? 0.4 : 1
            }).addTo(map);

            // Popup (Only if not editing another one)
            if (!editingPlotId) {
                const popupContent = document.createElement('div');
                popupContent.className = 'text-center p-1 min-w-[150px]';
                popupContent.innerHTML = `
                    <div class="text-[10px] text-gray-500 mb-1">${company?.name || '?'} > ${field?.name || '?'}</div>
                    <div class="font-bold text-sm text-gray-800 mb-2">${plot.name}</div>
                    <button id="btn-reubicar-${plot.id}" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-md flex items-center justify-center w-full gap-1 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><circle cx="12" cy="12" r="3"></circle></svg>
                        REUBICAR
                    </button>
                    <div class="text-[9px] text-gray-400 mt-2">Lat: ${plot.lat?.toFixed(5)}, Lng: ${plot.lng?.toFixed(5)}</div>
                `;

                marker.bindPopup(popupContent);

                marker.on('popupopen', () => {
                    const btn = document.getElementById(`btn-reubicar-${plot.id}`);
                    if (btn) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            marker.closePopup();
                            startEditing(plot);
                        };
                    }
                });
            }

            // Drag Events
            if (isEditing) {
                marker.on('drag', (e: any) => {
                    const pos = e.target.getLatLng();
                    setTempPos({ lat: pos.lat, lng: pos.lng });
                });
            }

            markersRef.current.push(marker);
            group.addLayer(marker);
        });

        // Fit bounds only on initial load or filter change, not during edit
        if (!editingPlotId && markersRef.current.length > 0) {
            // Check if bounds actually changed significantly to avoid jitter? 
            // For now, only fit if we are not editing.
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        }

    }, [isOpen, filteredPlots, editingPlotId, mapType]); // Re-render when edit state changes

    // Actions
    const startEditing = (plot: Plot) => {
        setEditingPlotId(plot.id);
        setTempPos({ lat: plot.lat!, lng: plot.lng! });
    };

    const cancelEditing = () => {
        setEditingPlotId(null);
        setTempPos(null);
    };

    const saveLocation = async () => {
        if (!editingPlotId || !tempPos) return;
        await onUpdatePlot(editingPlotId, tempPos.lat, tempPos.lng);
        setEditingPlotId(null);
        setTempPos(null);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Mapa de Lotes" maxWidth="max-w-[95vw]">
            <div className="flex flex-col h-[85vh]">

                {/* Filters Bar */}
                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4 z-10">
                    <div className="flex-1 min-w-[200px]">
                        <Select
                            label=""
                            placeholder="Todas las Empresas..."
                            options={companies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))}
                            value={filterCompanyId}
                            onChange={(e) => { setFilterCompanyId(e.target.value); setFilterFieldId(''); }}
                            className="w-full"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <Select
                            label=""
                            placeholder="Todos los Campos..."
                            options={availableFields.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))}
                            value={filterFieldId}
                            onChange={(e) => setFilterFieldId(e.target.value)}
                            disabled={!filterCompanyId}
                            className="w-full"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none text-sm dark:text-gray-200"
                        />
                    </div>
                </div>

                {/* Map Container */}
                <div className="flex-1 relative bg-gray-100 dark:bg-gray-900 overflow-hidden">
                    <div ref={mapDivRef} className="w-full h-full z-0" />

                    {/* Edit Mode Controls */}
                    {editingPlotId && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[500] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-xs font-bold flex items-center gap-2">
                                <Move className="w-3 h-3 animate-pulse" /> MODO REUBICACIÓN
                            </div>
                            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <button onClick={saveLocation} className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors shadow-sm font-medium">
                                <Check className="w-3 h-3" /> Guardar
                            </button>
                            <button onClick={cancelEditing} className="flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 px-3 py-1 rounded text-sm transition-colors font-medium">
                                <X className="w-3 h-3" /> Cancelar
                            </button>
                        </div>
                    )}

                    {/* Map Controls */}
                    <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
                        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                            <button onClick={() => setMapType(prev => prev === 'satellite' ? 'street' : 'satellite')} className="p-2 text-gray-700 dark:text-gray-300 hover:text-agro-600 dark:hover:text-agro-400 transition-colors" title="Cambiar tipo de mapa">
                                <Layers className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Footer Info */}
                    {!editingPlotId && (
                        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-gray-900/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
                            <p className="font-bold flex items-center gap-1"><MapIcon className="w-3 h-3" /> {filteredPlots.length} Lotes visibles</p>
                            <p className="opacity-70 mt-0.5">Haz clic en un lote para reubicarlo.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
