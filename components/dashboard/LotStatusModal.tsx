import React, { useState, useEffect, useMemo } from 'react';
import { LotSummary, AppState, User, MonitoringRecord } from '../../types';
import { CheckCircle2, User as UserIcon, Calendar, MapPin, Play, Pause, Save, Mic, StopCircle, ArrowLeft, AlertTriangle, Bug, ImageIcon, ClipboardList } from 'lucide-react';
import { Modal, Button } from '../UI';
import * as Storage from '../../services/storageService';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';

interface LotStatusModalProps {
    summary: LotSummary | null;
    isOpen: boolean;
    onClose: () => void;
    data: AppState;
    currentUser: User | null;
}

export const LotStatusModal: React.FC<LotStatusModalProps> = ({
    summary,
    isOpen,
    onClose,
    data,
    currentUser
}) => {
    // Determine if we are viewing samples or the summary status
    // To keep it simple and self-contained, we can assert state here.
    // If we want "Ver Muestras", we flip a local state switch.
    const [viewMode, setViewMode] = useState<'status' | 'samples'>('status');

    // Reset view mode when summary changes or opens
    useEffect(() => {
        if (isOpen) setViewMode('status');
    }, [isOpen, summary]);

    // --- ENGINEER FEEDBACK STATE ---
    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();
    const [feedbackStatus, setFeedbackStatus] = useState<'verde' | 'amarillo' | 'rojo'>('verde');
    const [feedbackNotes, setFeedbackNotes] = useState('');
    const [isSavingFeedback, setIsSavingFeedback] = useState(false);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Initialize form when opening
    useEffect(() => {
        if (summary) {
            setFeedbackStatus(summary.engineerStatus || ((summary.id || summary._operationId) ? summary.status : 'verde'));
            setFeedbackNotes(summary.engineerNotes || '');
            resetRecording();
        }
    }, [summary]);

    const handleSaveFeedback = async () => {
        if (!summary || !currentUser) return;

        setIsSavingFeedback(true);
        try {
            if (summary.id) {
                await Storage.updateLotSummaryFeedback(
                    summary.id,
                    feedbackStatus,
                    feedbackNotes,
                    currentUser?.name || 'Ingeniero',
                    audioBlobUrl || undefined,
                    audioDuration
                );
            } else {
                // New logic (Assign initial status)
                await Storage.addLotSummary({
                    ...summary,
                    status: feedbackStatus,
                    engineerStatus: feedbackStatus,
                    engineerNotes: feedbackNotes,
                    engineerName: currentUser?.name || 'Ingeniero',
                    engineerStatusDate: new Date().toISOString(),
                    engineerAudioDuration: audioDuration,
                    isReviewed: true,
                    userName: currentUser.name,
                    userId: currentUser.id,
                    notes: '[Validación técnica sin monitoreo previo]'
                }, audioBlobUrl || undefined);
            }
            onClose();
        } catch (error) {
            console.error("Error saving feedback", error);
        } finally {
            setIsSavingFeedback(false);
        }
    };

    const toggleAudio = (url: string, id: string) => {
        if (playingAudioId === id) {
            setPlayingAudioId(null);
            const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
            if (audio) audio.pause();
        } else {
            setPlayingAudioId(id);
            const audio = document.getElementById(`audio-${id}`) as HTMLAudioElement;
            if (audio) { audio.play().catch(console.error); audio.onended = () => setPlayingAudioId(null); }
        }
    };

    const formatDate = (iso: string) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const relevantSamples = useMemo(() => {
        if (!summary) return [];
        return data.monitorings.filter(m =>
            m.plotId === summary.plotId &&
            (summary.seasonId ? m.seasonId === summary.seasonId : true)
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [summary, data.monitorings]);

    const isEngineer = currentUser?.role === 'admin';

    // If no summary, don't render content (Modal handles isOpen)
    if (!summary) return null;

    if (viewMode === 'samples') {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Muestreos Realizados" zIndex={200000}>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                    {relevantSamples.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 italic">No hay muestras registradas para este lote.</div>
                    ) : (
                        <div className="space-y-3">
                            {relevantSamples.map((sample: MonitoringRecord) => (
                                <div key={sample.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm hover:border-agro-400 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold">M#{sample.sampleNumber}</span>
                                                <span className="text-xs text-gray-500 font-medium">{formatDate(sample.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {sample.phenology && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sample.phenology.startsWith('V') ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:border-green-800' :
                                                        sample.phenology.startsWith('R') ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:border-amber-800' :
                                                            'bg-gray-50 text-gray-600 border-gray-200'
                                                        }`}>
                                                        {sample.phenology}
                                                    </span>
                                                )}
                                                {sample.standData && sample.standData.plantsPerHectare > 0 && (
                                                    <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                                        <b>{sample.standData.plantsPerHectare.toLocaleString()}</b> pl/Ha
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center text-[10px] text-gray-400 uppercase font-bold">
                                            <UserIcon className="w-3 h-3 mr-1" /> {sample.userName}
                                        </div>
                                    </div>

                                    {sample.pestData && sample.pestData.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            {sample.pestData.map((pd, idx) => (
                                                <div key={idx} className="flex items-center bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
                                                    <Bug className="w-3.5 h-3.5 text-red-500 mr-2 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200 block truncate">{pd.name}</span>
                                                        <span className="text-[10px] text-gray-500 font-mono">{pd.value} <span className="opacity-70">{pd.unit}</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg border border-green-100 dark:border-green-800/50 flex items-center mb-2">
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> Sin novedades registradas.
                                        </div>
                                    )}

                                    {sample.observations && (
                                        <p className="text-xs text-gray-600 dark:text-gray-400 italic bg-gray-50/50 dark:bg-gray-900/20 p-2 rounded border border-gray-100 dark:border-gray-800 mb-2">
                                            "{sample.observations}"
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        {sample.media?.photoUrl && (
                                            <button onClick={() => setPreviewImage(sample.media!.photoUrl!)} className="flex-1 flex items-center justify-center p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 rounded-lg text-[10px] font-bold border border-blue-100 dark:border-blue-800">
                                                <ImageIcon className="w-3 h-3 mr-1" /> VER FOTO
                                            </button>
                                        )}
                                        {sample.media?.audioUrl && (
                                            <button onClick={() => toggleAudio(sample.media!.audioUrl!, sample.id)} className="flex-1 flex items-center justify-center p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-[10px] font-bold">
                                                {playingAudioId === sample.id ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                                                AUDIO
                                                <audio id={`audio-${sample.id}`} src={sample.media.audioUrl} className="hidden" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => setViewMode('status')} className="text-agro-600 dark:text-agro-400 text-xs font-bold flex items-center hover:underline">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> VOLVER A VALIDACIÓN
                    </button>
                    <Button variant="ghost" onClick={onClose}>Cerrar</Button>
                </div>

                {previewImage && (
                    <div className="fixed inset-0 z-[200001] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
                        <img src={previewImage} className="max-w-full max-h-[90vh] rounded-lg" alt="Preview" />
                    </div>
                )}
            </Modal>
        );
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={(summary?.id || summary?._operationId) ? "Detalle de Estado" : "Asignar Estado Lote"} zIndex={200000}>
            <div className="space-y-4">
                <div className="flex justify-between items-start bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg">
                            {data.plots.find(p => p.id === summary.plotId)?.name}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            {data.fields.find(f => f.id === summary.fieldId)?.name}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center text-xs font-mono text-gray-600 dark:text-gray-400">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(summary.date)}
                        </div>
                        {summary.id && (
                            <div className="flex items-center justify-end text-xs text-gray-500 mt-1">
                                <UserIcon className="w-3 h-3 mr-1" />
                                {summary.userName}
                            </div>
                        )}
                    </div>
                </div>

                {(summary.id || summary._operationId) && (
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-gray-500 uppercase">Reporte Operario</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${summary.status === 'verde' ? 'bg-green-50 text-green-700 border-green-200' :
                                summary.status === 'amarillo' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                {summary.status}
                            </span>
                        </div>

                        {summary.notes ? (
                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{summary.notes}"</p>
                        ) : <span className="text-xs text-gray-400 italic">Sin notas escritas.</span>}

                        {summary.audioUrl && (
                            <button onClick={() => toggleAudio(summary.audioUrl!, 'summ-audio')} className="flex items-center space-x-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-agro-600 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg w-full justify-center">
                                {playingAudioId === 'summ-audio' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                <span>Reproducir Audio Operario</span>
                                <audio id="audio-summ-audio" src={summary.audioUrl} className="hidden" />
                            </button>
                        )}
                    </div>
                )}

                {!summary.id && isEngineer && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50">
                        <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                            Estás asignando un estado inicial. Esto creará un reporte técnico basado en los muestreos.
                        </p>
                    </div>
                )}

                <hr className="border-gray-200 dark:border-gray-700" />

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800 dark:text-white">Validación Técnica (Ingeniero)</span>
                        {isEngineer && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded">Editable</span>}
                    </div>

                    {isEngineer ? (
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800/30 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                                {(['verde', 'amarillo', 'rojo'] as const).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setFeedbackStatus(s)}
                                        className={`py-1.5 rounded-md text-xs font-bold uppercase border-2 transition-all ${feedbackStatus === s
                                            ? (s === 'verde' ? 'bg-green-500 text-white border-green-600' : s === 'amarillo' ? 'bg-yellow-500 text-white border-yellow-600' : 'bg-red-500 text-white border-red-600')
                                            : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-300'
                                            }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-white resize-none h-20"
                                placeholder="Escriba aquí su devolución técnica o recomendación..."
                                value={feedbackNotes}
                                onChange={(e) => setFeedbackNotes(e.target.value)}
                            />

                            <div className="flex gap-2">
                                <div
                                    onClick={toggleRecording}
                                    className={`flex-1 border-2 border-dashed rounded-lg h-10 flex items-center justify-center cursor-pointer transition-colors ${isRecording ? 'border-red-500 bg-red-50 text-red-600' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-white dark:hover:bg-gray-700'}`}
                                >
                                    {isRecording ? (
                                        <><StopCircle className="w-4 h-4 mr-2 animate-pulse" /> <span className="text-xs font-bold">{audioDuration}s</span></>
                                    ) : (
                                        <><Mic className={`w-4 h-4 mr-2 ${(audioDuration > 0 || (summary && summary.engineerAudioUrl)) ? 'text-green-500' : ''}`} /> <span className="text-xs">{(audioDuration > 0 || (summary && summary.engineerAudioUrl)) ? 'Audio OK' : 'Grabar Voz'}</span></>
                                    )}
                                </div>

                                <Button onClick={handleSaveFeedback} disabled={isSavingFeedback} className="bg-blue-600 hover:bg-blue-700 text-white px-4 h-10 text-xs">
                                    <Save className="w-4 h-4 mr-1.5" /> Guardar
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${summary.engineerStatus === 'verde' ? 'bg-green-100 text-green-800 border-green-200' :
                                    summary.engineerStatus === 'amarillo' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                        summary.engineerStatus === 'rojo' ? 'bg-red-100 text-red-800 border-red-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                    }`}>
                                    {summary.engineerStatus || 'Pendiente'}
                                </span>
                            </div>
                            {summary.engineerNotes ? (
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-2">"{summary.engineerNotes}"</p>
                            ) : <span className="text-xs text-gray-400 italic block mb-2">Sin notas del ingeniero.</span>}

                            {summary.engineerAudioUrl && (
                                <button onClick={() => toggleAudio(summary.engineerAudioUrl!, 'eng-audio')} className="flex items-center justify-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors text-xs font-medium w-full">
                                    {playingAudioId === 'eng-audio' ? <Pause className="w-3.5 h-3.5 mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
                                    Escuchar Feedback
                                    <audio id="audio-eng-audio" src={summary.engineerAudioUrl} className="hidden" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end pt-2 gap-2 border-t border-gray-100 dark:border-gray-700 mt-2">
                    <Button variant="secondary" onClick={() => setViewMode('samples')} className="text-xs h-9">
                        <ClipboardList className="w-3.5 h-3.5 mr-1.5" /> Ver Muestras
                    </Button>
                    <Button variant="ghost" onClick={onClose} className="text-xs h-9">Cerrar</Button>
                </div>
            </div>
        </Modal>
    );
};
