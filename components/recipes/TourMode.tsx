import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { Select, Button, MultiSelect, Input } from '../UI';
import {
    Plus, Trash2, Save, Mic, StopCircle, Play, Pause,
    ArrowRight, MapPin, CheckCircle2, AlertTriangle,
    ChevronRight, X, List, Calendar, FileText, Split, LayoutList
} from 'lucide-react';
import * as Storage from '../../services/storageService';
import { PrescriptionItem, Prescription } from '../../types';

// Internal type for a "Batch" during the tour
interface PrescriptionBatch {
    id: string;
    plotIds: string[];
    plotMetadata: Record<string, { affectedHectares?: number; observation?: string }>;
    items: PrescriptionItem[];
    taskIds: string[];
    notes: string;
    audioBlobUrl: string | null;
    audioDuration: number;
}

interface TourModeProps {
    onCancel: () => void;
    onFinish: () => void;
}

export const TourMode: React.FC<TourModeProps> = ({ onCancel, onFinish }) => {
    const { data, userCompanies, dataOwnerId, dataOwnerName } = useData();
    const { showNotification } = useUI();
    const { currentUser } = useAuth();

    // SAFEGUARDS: Ensure data arrays exist to prevent crashes
    // Use optional chaining and default empty arrays
    const safeFields = data?.fields || [];
    const safePlots = data?.plots || [];
    const safeAgrochemicals = data?.agrochemicals || [];
    const safeTasks = data?.tasks || [];

    // --- Step 1: Global Context (The Tour) ---
    const [selectedCompanyId, setSelectedCompanyId] = useState('');
    const [selectedFieldId, setSelectedFieldId] = useState('');

    // --- Step 2: Current Batch Builder ---
    const [currentStep, setCurrentStep] = useState<'context' | 'batch' | 'review'>('context');
    const [batches, setBatches] = useState<PrescriptionBatch[]>([]);

    // Batch State
    const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
    const [plotMetadata, setPlotMetadata] = useState<Record<string, { affectedHectares?: number; observation?: string }>>({});

    const [items, setItems] = useState<PrescriptionItem[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [currentItemId, setCurrentItemId] = useState('');
    const [currentDose, setCurrentDose] = useState('');
    const [currentUnit, setCurrentUnit] = useState('Lt/Ha');

    // Audio
    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    // Filtered Data
    const availableFields = safeFields.filter(f => f.companyId === selectedCompanyId);
    const availablePlots = safePlots.filter(p => p.fieldId === selectedFieldId);

    // Helpers
    const generateId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const handleStartTour = () => {
        if (!selectedCompanyId || !selectedFieldId) {
            showNotification("Seleccione Empresa y Campo para iniciar", "error");
            return;
        }
        setCurrentStep('batch');
    };

    const handleAddItem = () => {
        if (!currentItemId || !currentDose) return;
        const supply = safeAgrochemicals.find(a => a.id === currentItemId);
        if (!supply) return;
        const newItem: PrescriptionItem = { supplyId: supply.id, supplyName: supply.name, dose: currentDose, unit: currentUnit };
        setItems([...items, newItem]);
        setCurrentItemId(''); setCurrentDose('');
    };

    const handleRemoveItem = (index: number) => { const newItems = [...items]; newItems.splice(index, 1); setItems(newItems); };
    const handleRemoveTask = (taskId: string) => { setSelectedTaskIds(prev => prev.filter(id => id !== taskId)); };

    const handleUpdatePlotMetadata = (plotId: string, field: 'affectedHectares' | 'observation', value: any) => {
        setPlotMetadata(prev => ({
            ...prev,
            [plotId]: {
                ...prev[plotId],
                [field]: value
            }
        }));
    };

    const handleAddToTour = () => {
        if (selectedPlotIds.length === 0) { showNotification("Seleccione al menos un lote", "error"); return; }
        if (items.length === 0 && selectedTaskIds.length === 0 && !notes && !audioBlobUrl) {
            showNotification("Agregue indicaciones (insumos, tareas o notas)", "error");
            return;
        }

        const newBatch: PrescriptionBatch = {
            id: generateId(),
            plotIds: [...selectedPlotIds],
            plotMetadata: { ...plotMetadata },
            items: [...items],
            taskIds: [...selectedTaskIds],
            notes,
            audioBlobUrl,
            audioDuration
        };

        setBatches([...batches, newBatch]);

        // Reset Batch Form
        setSelectedPlotIds([]);
        setPlotMetadata({});
        setItems([]);
        setSelectedTaskIds([]);
        setNotes('');
        resetRecording();
        showNotification("Lote(s) sumado(s) a la recorrida", "success");
    };

    const handleRemoveBatch = (batchId: string) => {
        setBatches(prev => prev.filter(b => b.id !== batchId));
    };

    const handleFinishTour = async () => {
        if (batches.length === 0) { showNotification("No hay recetas en esta recorrida", "error"); return; }
        if (!dataOwnerId) return;

        try {
            // Save all batches sequentially
            for (const batch of batches) {
                const plotNames = batch.plotIds.map(pid => safePlots.find(p => p.id === pid)?.name || 'Desconocido');
                const taskNames = batch.taskIds.map(tid => safeTasks.find(t => t.id === tid)?.name || 'Desconocido');

                // Add price snapshot
                const itemsWithSnapshot = batch.items.map(item => {
                    const product = safeAgrochemicals.find(a => a.id === item.supplyId);
                    return { ...item, lockedPrice: product?.price || 0 };
                });

                const prescriptionData = {
                    createdAt: Date.now(),
                    companyId: selectedCompanyId,
                    fieldId: selectedFieldId,
                    plotIds: batch.plotIds,
                    plotNames,
                    plotMetadata: batch.plotMetadata, // Save metadata
                    items: itemsWithSnapshot,
                    taskIds: batch.taskIds,
                    taskNames,
                    notes: batch.notes,
                    status: 'active' as const,
                    ownerId: dataOwnerId,
                    ownerName: dataOwnerName,
                    audioDuration: batch.audioDuration > 0 ? batch.audioDuration : undefined,
                    hasAudio: (batch.audioDuration > 0 || !!batch.audioBlobUrl)
                };

                // Note: storage service handles audio upload if blob is passed
                await Storage.addPrescription(prescriptionData, batch.audioBlobUrl || undefined);
            }

            showNotification(`Recorrida finalizada. ${batches.length} recetas creadas.`, "success");
            onFinish();
        } catch (error) {
            console.error("Error saving tour:", error);
            showNotification("Error al guardar la recorrida", "error");
        }
    };

    // --- RENDER ---

    // 1. Context Selection
    if (currentStep === 'context') {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-2xl mx-auto space-y-6 animate-fade-in">
                <div className="border-b pb-4 mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-agro-700 dark:text-agro-400">
                        <MapPin className="w-6 h-6" /> Iniciar Recorrida de Campo
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Seleccione el campo donde realizará la visita.</p>
                </div>

                <div className="space-y-4">
                    <Select
                        label="Empresa"
                        options={userCompanies.map(c => ({ value: c.id, label: c.name }))}
                        value={selectedCompanyId}
                        onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); }}
                    />
                    <Select
                        label="Campo"
                        options={availableFields.map(f => ({ value: f.id, label: f.name }))}
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value)}
                        disabled={!selectedCompanyId}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
                    <Button onClick={handleStartTour} disabled={!selectedFieldId}>
                        Comenzar Recorrida <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        );
    }

    // 2. Batch Review (Summary)
    if (currentStep === 'review') {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="border-b pb-4 mb-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-agro-700 dark:text-agro-400">
                            <CheckCircle2 className="w-6 h-6" /> Resumen de Recorrida
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Revise las {batches.length} recetas creadas antes de confirmar.</p>
                    </div>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {batches.map((batch, idx) => {
                        const batchPlotNames = batch.plotIds.map(pid => safePlots.find(p => p.id === pid)?.name).join(', ');
                        return (
                            <div key={batch.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/30">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-800 dark:text-white">#{idx + 1} - Lotes: {batchPlotNames}</h4>
                                    <button onClick={() => handleRemoveBatch(batch.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                                </div>

                                {batch.items.length > 0 && (
                                    <div className="mb-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Insumos:</p>
                                        <ul className="text-sm list-disc pl-4 text-gray-700 dark:text-gray-300">
                                            {batch.items.map((it, i) => (
                                                <li key={i}>{it.supplyName} - {it.dose} {it.unit}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {batch.notes && (
                                    <div className="mb-2 bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded text-sm italic text-gray-600 dark:text-gray-400 border border-yellow-100 dark:border-yellow-900/30">
                                        "{batch.notes}"
                                    </div>
                                )}

                                {batch.audioBlobUrl && (
                                    <div className="flex items-center gap-2 mt-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full w-fit">
                                        <Mic className="w-3 h-3 text-blue-600" />
                                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Audio grabado ({Math.round(batch.audioDuration)}s)</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between gap-3 pt-4 border-t border-gray-100">
                    <Button variant="secondary" onClick={() => setCurrentStep('batch')}>
                        Seguir Agregando
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="danger" onClick={onCancel} className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
                            Descartar Todo
                        </Button>
                        <Button onClick={handleFinishTour} className="bg-green-600 hover:bg-green-700 text-white">
                            Confirmar y Finalizar <CheckCircle2 className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Batch Builder (Main View)
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in relative pb-20">
            {/* Header / Nav */}
            <div className="lg:col-span-3 flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <LayoutList className="w-5 h-5 text-agro-600" />
                        Modo Recorrida
                    </h2>
                    <p className="text-xs text-gray-500">
                        {(safeFields.find(f => f.id === selectedFieldId)?.name) || 'Campo'}
                        <span className="mx-2">•</span>
                        {batches.length} Recetas en cola
                    </p>
                </div>
                <Button onClick={() => setCurrentStep('review')} disabled={batches.length === 0} variant={batches.length > 0 ? 'primary' : 'secondary'}>
                    Ver Resumen ({batches.length}) <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
            </div>

            {/* Left Col: Plot Selection & Details */}
            <div className="lg:col-span-1 space-y-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-fit">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-500" /> 1. Lotes Afectados
                    </h3>
                    <MultiSelect
                        label="Seleccionar Lotes"
                        options={availablePlots.map(p => ({ value: p.id, label: `${p.name} (${p.hectares} ha)` }))}
                        selectedValues={selectedPlotIds}
                        onChange={setSelectedPlotIds}
                    />

                    {/* Plot Specific Details (Hectares & Notes) */}
                    {selectedPlotIds.length > 0 && (
                        <div className="mt-4 space-y-3 animate-fade-in">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b pb-1 mb-2">Detalles por Lote</div>
                            {selectedPlotIds.map(pid => {
                                const p = safePlots.find(plot => plot.id === pid);
                                if (!p) return null;
                                const meta = plotMetadata[pid] || {};
                                const currentHa = meta.affectedHectares ?? p.hectares;

                                return (
                                    <div key={pid} className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <span className="font-bold text-sm text-blue-800 dark:text-blue-200 truncate pr-2">{p.name}</span>
                                            <span className="text-xs text-gray-500">{p.hectares} ha total</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[10px] text-gray-500 font-bold">A aplicar (Ha)</label>
                                                <input
                                                    type="number"
                                                    className="w-full text-xs p-1.5 rounded border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                                                    value={currentHa}
                                                    onChange={(e) => handleUpdatePlotMetadata(pid, 'affectedHectares', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 font-bold">Sector / Nota</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Sector Sur"
                                                    className="w-full text-xs p-1.5 rounded border border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                                                    value={meta.observation || ''}
                                                    onChange={(e) => handleUpdatePlotMetadata(pid, 'observation', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Middle Col: Recipe Definition */}
            <div className="lg:col-span-2 space-y-4">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-green-500" /> 2. Definición de Receta
                    </h3>

                    {/* Inputs */}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <div className="flex-1">
                            <Select
                                label="Insumo"
                                options={safeAgrochemicals.map(a => ({ value: a.id, label: a.name }))}
                                value={currentItemId}
                                onChange={(e) => {
                                    const id = e.target.value;
                                    setCurrentItemId(id);
                                    const supply = safeAgrochemicals.find(a => a.id === id);
                                    if (supply) {
                                        if (supply.priceUnit === 'Kg') setCurrentUnit('Kg/Ha');
                                        else setCurrentUnit('Lt/Ha');
                                    }
                                }}
                            />
                        </div>
                        <div className="w-full md:w-32"><Input label="Dosis" type="number" value={currentDose} onChange={(e) => setCurrentDose(e.target.value)} /></div>
                        <div className="w-full md:w-32"><Select label="Unidad" options={[{ value: 'Lt/Ha', label: 'Lt/Ha' }, { value: 'Kg/Ha', label: 'Kg/Ha' }, { value: 'ml/Ha', label: 'ml/Ha' }, { value: 'g/Ha', label: 'g/Ha' }]} value={currentUnit} onChange={(e) => setCurrentUnit(e.target.value)} disabled={true} /></div>
                        <div className="flex items-end pb-1"><Button onClick={handleAddItem} disabled={!currentItemId || !currentDose}><Plus className="w-4 h-4" /></Button></div>
                    </div>

                    {/* Items List */}
                    {items.length > 0 ? (
                        <div className="space-y-2 mb-4">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-2 rounded border border-gray-200 dark:border-gray-700">
                                    <span className="text-sm font-medium">{item.supplyName}</span>
                                    <span className="text-sm font-bold mx-2">{item.dose} {item.unit}</span>
                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    ) : <p className="text-sm text-gray-400 italic mb-4">Sin insumos agregados.</p>}

                    {/* Tasks */}
                    <div className="mb-4">
                        <MultiSelect
                            label="Labores / Tareas"
                            options={safeTasks.map(t => ({ value: t.id, label: t.name }))}
                            selectedValues={selectedTaskIds}
                            onChange={setSelectedTaskIds}
                        />
                    </div>

                    {/* Notes & Audio */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas Generales</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 h-24 text-sm resize-none"
                                placeholder="Notas generales para esta receta..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col justify-between">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota de Audio</label>

                            {!isRecording && !audioBlobUrl ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleRecording(); }}
                                    className="flex-1 w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group h-24"
                                >
                                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                        <Mic className="w-5 h-5 text-red-600" />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500">Grabar Nota de Voz</span>
                                </button>
                            ) : (
                                <div className="flex-1 w-full bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50 p-4 flex flex-col items-center justify-center relative h-24">
                                    {isRecording ? (
                                        <>
                                            <span className="animate-pulse text-red-600 font-bold mb-2 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-600"></div> Grabando...
                                            </span>
                                            <button onClick={(e) => { e.stopPropagation(); toggleRecording(); }} className="px-4 py-1.5 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition-colors">
                                                Detener
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full flex items-center justify-between px-2">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const audio = document.getElementById('preview-audio-tour') as HTMLAudioElement;
                                                        if (audio) {
                                                            if (playingAudioId === 'preview') { audio.pause(); setPlayingAudioId(null); }
                                                            else { audio.play(); setPlayingAudioId('preview'); audio.onended = () => setPlayingAudioId(null); }
                                                        }
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center hover:scale-105 transition-transform"
                                                >
                                                    {playingAudioId === 'preview' ? <Pause className="w-4 h-4 text-blue-600" /> : <Play className="w-4 h-4 text-blue-600 ml-0.5" />}
                                                </button>
                                                <div className="text-left">
                                                    <span className="block text-xs font-bold text-gray-800 dark:text-gray-200">Audio Grabado</span>
                                                    <span className="text-[10px] text-gray-500">{Math.round(audioDuration)} seg</span>
                                                </div>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); resetRecording(); }} className="text-gray-400 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                                            <audio id="preview-audio-tour" src={audioBlobUrl || ""} className="hidden" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Add Batch Button */}
                <button
                    onClick={handleAddToTour}
                    disabled={selectedPlotIds.length === 0}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> Agregar a la Recorrida
                </button>
            </div>
        </div>
    );
};
