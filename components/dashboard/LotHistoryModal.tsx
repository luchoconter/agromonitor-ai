
import React, { useMemo, useState, useRef } from 'react';
import { AppState, MonitoringRecord, LotSummary, Prescription } from '../../types';
import { X, Bug, FileText, CheckCircle2, Flag, Calendar, User, Play, Pause, Clock, AlertTriangle, Droplets, Leaf, Sprout, Tractor, History, LayoutDashboard } from 'lucide-react';

interface LotHistoryModalProps {
    plotId: string;
    onClose: () => void;
    data: AppState;
}

export const LotHistoryModal: React.FC<LotHistoryModalProps> = ({ plotId, onClose, data }) => {
    const plot = data.plots.find(p => p.id === plotId);
    const field = data.fields.find(f => f.id === plot?.fieldId);
    const company = data.companies.find(c => c.id === plot?.companyId);

    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const toggleAudio = (url: string, id: string) => {
        if (playingAudioId === id) {
            const audio = document.getElementById(`history-audio-${id}`) as HTMLAudioElement;
            if (audio) audio.pause();
            setPlayingAudioId(null);
        } else {
            setPlayingAudioId(id);
            const audio = document.getElementById(`history-audio-${id}`) as HTMLAudioElement;
            if (audio) { audio.play().catch(console.error); audio.onended = () => setPlayingAudioId(null); }
        }
    };

    const historyEvents = useMemo(() => {
        const events: any[] = [];

        // 1. Summaries (Cierres)
        data.lotSummaries.filter(s => s.plotId === plotId).forEach(s => {
            events.push({
                id: s.id,
                type: 'summary',
                date: s.date,
                data: s
            });
        });

        // 2. Prescriptions (Recipes) & Applications
        data.prescriptions.filter(p => p.plotIds.includes(plotId)).forEach(p => {
            // Event A: Creation (Suggestion)
            // Fix: Use createdAt instead of date (which might be invalid or future-focused)
            const createdDate = p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString();

            events.push({
                id: `presc-create-${p.id}`,
                type: 'prescription_created',
                date: createdDate,
                data: p
            });

            // Event B: Execution (Application)
            const exec = p.executionData?.[plotId];
            if (exec && exec.executed && exec.executedAt) {
                events.push({
                    id: `presc-exec-${p.id}`,
                    type: 'application',
                    date: exec.executedAt,
                    data: { ...exec, prescription: p }
                });
            }
        });

        // 3. Crop Assignments (History)
        data.assignments.filter(a => a.plotId === plotId).forEach(a => {
            const season = data.seasons.find(s => s.id === a.seasonId);

            if (a.history && a.history.length > 0) {
                // NEW: Use granular history if available
                a.history.forEach((h, index) => {
                    const hCrop = data.crops.find(c => c.id === h.cropId);
                    events.push({
                        id: `assig-${a.id}-hist-${index}`,
                        type: 'crop_assignment',
                        date: h.date,
                        data: {
                            ...a,
                            cropName: hCrop?.name,
                            seasonName: season?.name,
                            action: h.action, // 'created' | 'updated'
                            originalStand: h.originalStand,
                            historyUser: h.userName || h.userId // To show who made the change
                        }
                    });
                });
            } else {
                // FALLBACK: Legacy data without history
                const crop = data.crops.find(c => c.id === a.cropId);

                // Proxy date logic (same as before)
                let proxyDate = new Date().toISOString();
                if (season?.name.includes('/')) {
                    const yearParts = season.name.split('/');
                    const year = parseInt(yearParts[0]);
                    if (!isNaN(year)) {
                        proxyDate = new Date(year, 8, 1).toISOString();
                    }
                } else if (season?.name) {
                    const match = season.name.match(/20\d\d/);
                    if (match) {
                        proxyDate = new Date(parseInt(match[0]), 8, 1).toISOString();
                    }
                }

                events.push({
                    id: `assig-${a.id}`,
                    type: 'crop_assignment',
                    date: proxyDate,
                    data: { ...a, cropName: crop?.name, seasonName: season?.name, action: 'created' }
                });
            }
        });

        return events.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            // Handle invalid dates by pushing them to the bottom
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            return dateB - dateA;
        });
    }, [plotId, data]);

    if (!plot) return null;

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatShortDate = (iso: string) => {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString();
    };

    return (
        <div className="fixed inset-0 z-[200000] flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
            {/* DRAWER CONTAINER */}
            <div className="w-full max-w-lg bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col animate-slide-in-right relative">

                {/* HEADER */}
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <History className="w-5 h-5 text-agro-600" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Bitácora del Lote</h2>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {company?.name} / {field?.name} / <strong className="text-gray-800 dark:text-gray-200">{plot.name}</strong>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* TIMELINE CONTENT */}
                <div className="flex-1 overflow-y-auto p-5 bg-gray-50 dark:bg-black/20">
                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:dark:via-gray-700 before:to-transparent">

                        {historyEvents.length === 0 && (
                            <div className="text-center py-10 text-gray-400 italic">No hay historial registrado.</div>
                        )}

                        {historyEvents.map((event) => (
                            <div key={event.id} className="relative flex items-start group">
                                {/* ICON MARKER */}
                                <div className={`absolute left-0 top-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white dark:border-gray-900 shadow-sm z-10 
                                    ${event.type === 'summary' ? (event.data.status === 'rojo' ? 'bg-red-100 text-red-600' : event.data.status === 'amarillo' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600') :
                                        event.type === 'prescription_created' ? 'bg-blue-100 text-blue-600' :
                                            event.type === 'crop_assignment' ? 'bg-amber-100 text-amber-600' :
                                                'bg-emerald-100 text-emerald-600' /* application */
                                    }`}>
                                    {event.type === 'summary' && <Flag className="w-5 h-5" />}
                                    {event.type === 'prescription_created' && <FileText className="w-5 h-5" />}
                                    {event.type === 'application' && <CheckCircle2 className="w-5 h-5" />}
                                    {event.type === 'crop_assignment' && <Sprout className="w-5 h-5" />}
                                </div>

                                {/* CONTENT CARD */}
                                <div className="ml-16 w-full">
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative hover:shadow-md transition-shadow">

                                        {/* Header of Card */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className={`text-xs font-bold uppercase tracking-wider mb-1 block
                                                    ${event.type === 'summary' ? (event.data.status === 'rojo' ? 'text-red-600' : event.data.status === 'amarillo' ? 'text-yellow-600' : 'text-green-600') :
                                                        event.type === 'prescription_created' ? 'text-blue-600' :
                                                            event.type === 'crop_assignment' ? 'text-amber-600' :
                                                                'text-emerald-600'}`}>
                                                    {event.type === 'summary' ? `Cierre de Lote (${event.data.status})` :
                                                        event.type === 'prescription_created' ? 'Receta Generada' :
                                                            event.type === 'crop_assignment' ? 'Inicio de Campaña' :
                                                                'Aplicación Confirmada'}
                                                </span>
                                                <div className="text-xs text-gray-400 flex items-center font-mono">
                                                    <Clock className="w-3 h-3 mr-1" /> {formatDate(event.date)}
                                                </div>
                                            </div>
                                            {(event.data.userName || event.data.executedBy || event.data.ownerName) && (
                                                <div className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full flex items-center">
                                                    <User className="w-3 h-3 mr-1" />
                                                    {event.data.userName || event.data.executedBy || event.data.ownerName || event.data.historyUser}
                                                </div>
                                            )}
                                        </div>

                                        {/* DETAIL CONTENT */}

                                        {/* 1. CROP ASSIGNMENT */}
                                        {event.type === 'crop_assignment' && (
                                            <div className="text-sm bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Tractor className="w-4 h-4 text-amber-600" />
                                                    <span className="font-bold text-amber-800 dark:text-amber-200">Asignación de Cultivo</span>
                                                </div>
                                                <div className="pl-6 text-gray-700 dark:text-gray-300">
                                                    Se asignó <strong className="text-gray-900 dark:text-white">{event.data.cropName}</strong> para la campaña {event.data.seasonName}.
                                                    {event.data.originalStand && (
                                                        <div className="mt-1 text-xs text-gray-500">
                                                            Stand Objetivo: <strong>{event.data.originalStand.toLocaleString()} pl/Ha</strong>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. SUMMARY DETAIL */}
                                        {event.type === 'summary' && (
                                            <div className="text-sm">
                                                {event.data.notes && <p className="text-gray-700 dark:text-gray-300 mb-2 italic">"{event.data.notes}"</p>}
                                                {event.data.engineerNotes && (
                                                    <div className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-2 rounded border border-blue-100 dark:border-blue-800 mb-2">
                                                        <b>Ingeniero:</b> {event.data.engineerNotes}
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    {event.data.audioUrl && (
                                                        <button onClick={() => toggleAudio(event.data.audioUrl, `sum-${event.id}`)} className="text-xs text-gray-500 underline flex items-center"><Play className="w-3 h-3 mr-1" /> Audio Operario <audio id={`history-audio-sum-${event.id}`} src={event.data.audioUrl} className="hidden" /></button>
                                                    )}
                                                    {event.data.engineerAudioUrl && (
                                                        <button onClick={() => toggleAudio(event.data.engineerAudioUrl, `eng-${event.id}`)} className="text-xs text-blue-500 underline flex items-center"><Play className="w-3 h-3 mr-1" /> Audio Ingeniero <audio id={`history-audio-eng-${event.id}`} src={event.data.engineerAudioUrl} className="hidden" /></button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. PRESCRIPTION CREATED */}
                                        {event.type === 'prescription_created' && (
                                            <div className="text-sm">
                                                <div className="mb-2">
                                                    {event.data.items.length > 0 && (
                                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-xs text-blue-800 dark:text-blue-200 border border-blue-100 dark:border-blue-800/50">
                                                            <strong className="block mb-1">Insumos:</strong>
                                                            <ul className="list-disc list-inside">
                                                                {event.data.items.map((it: any, i: number) => (
                                                                    <li key={i}>{it.supplyName} ({it.dose} {it.unit})</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                                {event.data.taskNames.length > 0 && <p className="text-xs text-gray-500 mb-1">Labores: {event.data.taskNames.join(', ')}</p>}
                                                {event.data.notes && <p className="text-xs italic text-gray-500 dark:text-gray-400">"{event.data.notes}"</p>}
                                                {event.data.audioUrl && (
                                                    <button onClick={() => toggleAudio(event.data.audioUrl, `pre-${event.id}`)} className="mt-2 text-xs flex items-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded transition-colors hover:bg-gray-200 dark:hover:bg-gray-600"><Play className="w-3 h-3 mr-1" /> Escuchar Indicaciones <audio id={`history-audio-pre-${event.id}`} src={event.data.audioUrl} className="hidden" /></button>
                                                )}
                                            </div>
                                        )}

                                        {/* 4. APPLICATION CONFIRMED */}
                                        {event.type === 'application' && (
                                            <div className="text-sm">
                                                <div className="flex items-center text-emerald-600 dark:text-emerald-400 mb-2">
                                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                                    <span className="font-bold">Labor Completada</span>
                                                </div>
                                                {event.data.observation && (
                                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded text-xs text-emerald-800 dark:text-emerald-200 border border-emerald-100 dark:border-emerald-800/50">
                                                        <span className="font-bold block mb-0.5">Observación del Cliente:</span>
                                                        "{event.data.observation}"
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-400 mt-2">Corresponde a receta del {formatDate(event.data.prescription.createdAt ? new Date(event.data.prescription.createdAt).toISOString() : event.data.prescription.date)}</p>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* PREVIEW IMAGE MODAL (Nested) */}
            {previewImage && (
                <div className="fixed inset-0 z-[200001] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
                    <img src={previewImage} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                    <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="w-8 h-8" /></button>
                </div>
            )}
        </div>
    );
};
