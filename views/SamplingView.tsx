
import React, { useState } from 'react';
import { MapPin, Camera, StopCircle, Mic, Sprout, ChevronDown, ChevronUp } from 'lucide-react';
import { MultiSelect, Button } from '../components/UI';
import { useGPS } from '../hooks/useGPS';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useMonitoringForm } from '../hooks/useMonitoringForm';
import { useOfflineMedia } from '../hooks/useOfflineMedia';

export const SamplingView: React.FC = () => {
    const { currentUser } = useAuth();
    const { data, dataOwnerId, dataOwnerName } = useData();
    const { selection, editingMonitoringId, setEditingMonitoringId, setView, showNotification } = useUI();

    // Stand Logic
    const [isStandExpanded, setIsStandExpanded] = useState(false);

    // --- 1. Navigation & Context Logic ---
    const { currentLocation, gpsStatus } = useGPS();
    const currentPlot = data.plots.find(p => p.id === selection.plotId);
    const currentAssignment = data.assignments.find(a => a.plotId === selection.plotId && a.seasonId === selection.seasonId);
    const currentCrop = data.crops.find(c => c.id === currentAssignment?.cropId);

    // Sample Number Calculation
    const todaysSamplesBase = data.monitorings.filter(m =>
        m.plotId === selection.plotId &&
        m.seasonId === selection.seasonId &&
        new Date(m.date).toDateString() === new Date().toDateString()
    );
    const todaysSamples = useOfflineMedia(todaysSamplesBase); // Enriquecer con multimedia offline
    console.log('🔢 [SamplingView] todaysSamples:', todaysSamples.length, 'muestreos encontrados');

    const nextSampleNumber = todaysSamples.length > 0
        ? Math.max(...todaysSamples.map(m => m.sampleNumber || 0)) + 1
        : 1;
    console.log('➡️ [SamplingView] nextSampleNumber calculado:', nextSampleNumber);

    const currentSampleNumber = editingMonitoringId ? data.monitorings.find(m => m.id === editingMonitoringId)?.sampleNumber : nextSampleNumber;

    // --- 2. Media Logic ---
    const recorder = useMediaRecorder();

    // --- 3. Form Business Logic (Custom Hook) ---
    const form = useMonitoringForm({
        currentUser,
        dataOwnerId,
        dataOwnerName,
        selection,
        editingMonitoringId,
        showNotification,
        onSuccess: () => {
            setEditingMonitoringId(null);
            setView('history');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.submitMonitoring(
            currentLocation,
            recorder.audioBlobUrl,
            recorder.audioDuration,
            recorder.hasAudio,
            currentSampleNumber || 1
        );
    };

    // Determine Active Location for Display
    const activeLocation = editingMonitoringId ? form.originalLocation : currentLocation;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* INFO & GPS SECTION */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600">
                        <div className="p-4 text-sm flex flex-col gap-2">
                            <div className="flex justify-between">
                                <span>Lote: <b>{currentPlot?.name}</b></span>
                                <span>Cultivo: <b>{currentCrop?.name || '-'}</b></span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600 mt-1">
                                <span>Muestreo: <b>M{currentSampleNumber}</b></span>

                                {/* GPS Status Text */}
                                {editingMonitoringId ? (
                                    <span className="flex items-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                                        <MapPin className="w-3 h-3 mr-1" /> Original
                                    </span>
                                ) : (
                                    gpsStatus === 'locked' && currentLocation ? (
                                        <span className="flex items-center text-green-600 dark:text-green-400 font-bold text-xs">
                                            <MapPin className="w-3 h-3 mr-1" /> GPS: ±{Math.round(currentLocation.accuracy)}m
                                        </span>
                                    ) : (
                                        <span className="flex items-center text-red-500 font-bold text-xs animate-pulse">
                                            <MapPin className="w-3 h-3 mr-1" /> {gpsStatus === 'searching' ? 'Buscando...' : 'SIN GPS'}
                                        </span>
                                    )
                                )}
                            </div>
                            {activeLocation && (
                                <div className="text-[10px] text-gray-400 font-mono text-right">
                                    {activeLocation.lat.toFixed(5)}, {activeLocation.lng.toFixed(5)}
                                </div>
                            )}
                        </div>
                    </div>



                    {/* STAND DE PLANTAS SECTION */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-all">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            onClick={() => setIsStandExpanded(!isStandExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${isStandExpanded ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                                    <Sprout className="w-4 h-4" />
                                </span>
                                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Stand de Plantas</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {form.plantsPerMeter && form.distanceBetweenRows && (
                                    <span className="text-xs font-mono bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 rounded shadow-sm border border-green-200 dark:border-green-800">
                                        {Math.round((parseFloat(form.plantsPerMeter) / parseFloat(form.distanceBetweenRows)) * 10000).toLocaleString()} pl/Ha
                                    </span>
                                )}
                                {isStandExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                        </div>

                        {isStandExpanded && (
                            <div className="p-4 pt-0 grid grid-cols-2 gap-3 animate-fade-in-down">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Plantas / Metro</label>
                                    <input
                                        type="number"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="0"
                                        value={form.plantsPerMeter}
                                        onChange={(e) => form.setPlantsPerMeter(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Distancia Hileras (m)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="0.52"
                                        value={form.distanceBetweenRows}
                                        onChange={(e) => form.setDistanceBetweenRows(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div><MultiSelect label="Plagas Detectadas" options={data.pests.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id, label: p.name }))} selectedValues={form.selectedPestIds} onChange={form.handlePestChange} placeholder="Seleccionar plagas..." /></div>

                    {form.selectedPestIds.length > 0 && (
                        <div className="space-y-2 border-t border-b border-gray-100 dark:border-gray-700 py-4">
                            {form.selectedPestIds.map(pestId => {
                                const pest = data.pests.find(p => p.id === pestId);
                                if (!pest) return null;
                                const unitLower = (pest.defaultUnit || '').toLowerCase();
                                const isQualitative = unitLower.includes('alta') || unitLower.includes('media') || unitLower.includes('concentracion');
                                return (
                                    <div key={pestId} className="flex flex-row items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <div className="flex-1 min-w-0"><span className="font-semibold text-gray-800 dark:text-gray-200 block text-sm truncate leading-tight">{pest.name}</span><span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate leading-tight mt-0.5">{pest.defaultUnit || '-'}</span></div>
                                        <div className="shrink-0">
                                            {isQualitative ? (
                                                <div className="flex rounded-md shadow-sm h-8" role="group">
                                                    {['Baja', 'Media', 'Alta'].map((level) => {
                                                        const isSelected = form.pestValues[pestId] === level;
                                                        return (<button key={level} type="button" onClick={() => form.handlePestValueChange(pestId, level)} className={`w-14 px-1 py-0 text-[10px] font-medium border first:rounded-l-lg last:rounded-r-lg focus:z-10 focus:ring-1 focus:ring-agro-500 transition-colors h-full flex items-center justify-center ${isSelected ? 'bg-agro-600 text-white border-agro-600 dark:bg-agro-500 dark:border-agro-500' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}>{level}</button>);
                                                    })}
                                                </div>
                                            ) : (
                                                <input type="number" placeholder="0" className="w-20 px-2 py-1.5 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-agro-500 outline-none text-right" value={form.pestValues[pestId] || ''} onChange={(e) => form.handlePestValueChange(pestId, e.target.value)} required />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-32 flex items-center justify-center relative bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors">
                            {form.photoUrl ? <img src={form.photoUrl} className="absolute inset-0 w-full h-full object-cover rounded-xl" /> : <div className="flex flex-col items-center text-gray-400"><Camera className="w-8 h-8 mb-1" /><span className="text-xs">Tomar Foto</span></div>}
                            <input type="file" accept="image/*" capture="environment" onChange={form.handlePhotoSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                        <div className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-32 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 cursor-pointer transition-colors ${recorder.isRecording ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`} onClick={recorder.toggleRecording}>
                            {recorder.isRecording ? <div className="flex flex-col items-center animate-pulse text-red-500"><StopCircle className="w-8 h-8 mb-1" /><span className="text-xs font-bold">{recorder.audioDuration}s</span></div> : <div className="flex flex-col items-center text-gray-400"><Mic className={`w-8 h-8 mb-1 ${(recorder.hasAudio || (editingMonitoringId && data.monitorings.find(m => m.id === editingMonitoringId)?.media?.hasAudio)) ? 'text-green-500' : ''}`} /><span className="text-xs">{(recorder.hasAudio || (editingMonitoringId && data.monitorings.find(m => m.id === editingMonitoringId)?.media?.hasAudio)) ? 'Audio Grabado' : 'Grabar Audio'}</span></div>}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones</h3>
                        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600">
                            <textarea name="observations" value={form.observationText} onChange={(e) => form.setObservationText(e.target.value)} className="w-full rounded-lg p-3 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-agro-500 outline-none min-h-[80px]" placeholder="Escriba aquí sus observaciones..." rows={3}></textarea>
                        </div>
                    </div>

                    <div className="pt-4"><Button type="submit" className="w-full h-12 text-lg" isLoading={form.isSubmitting}>{editingMonitoringId ? "Actualizar" : "Guardar"}</Button></div>
                </form>
            </div >
        </div >
    );
};
