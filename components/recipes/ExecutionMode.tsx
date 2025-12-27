import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import { Select, Button, Modal, Input } from '../UI';
import {
    CheckCircle2, Filter, Calendar, Mic, Play, Pause, Trash2,
    AlertTriangle, ShoppingCart, Info, MapPin, Clock
} from 'lucide-react';
import * as Storage from '../../services/storageService';
import { Prescription, PrescriptionExecution } from '../../types';

interface ExecutionModeProps {
    onBack: () => void;
    forcedCompanyId?: string;
}

export const ExecutionMode: React.FC<ExecutionModeProps> = ({ onBack, forcedCompanyId }) => {
    const { data, userCompanies } = useData();
    const { showNotification } = useUI();
    const { currentUser } = useAuth();

    // Filters
    const [selectedCompanyId, setSelectedCompanyId] = useState(forcedCompanyId || '');

    // Update if prop changes
    React.useEffect(() => {
        if (forcedCompanyId) setSelectedCompanyId(forcedCompanyId);
    }, [forcedCompanyId]);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [statusFilter, setStatusFilter] = useState<'pending' | 'executed'>('pending');

    // Execution Modal State
    const [executingRecipe, setExecutingRecipe] = useState<Prescription | null>(null);
    const [executingPlotId, setExecutingPlotId] = useState<string | null>(null);
    const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
    const [observation, setObservation] = useState('');

    // Audio State
    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    // Helpers
    const availableFields = data.fields.filter(f => !selectedCompanyId || f.companyId === selectedCompanyId);

    // Filter Recipes
    const filteredRecipes = useMemo(() => {
        return data.prescriptions.filter(p => {
            if (p.status === 'archived') return false;

            // Context Filters
            if (selectedCompanyId && p.companyId !== selectedCompanyId) return false;
            if (selectedFieldId && p.fieldId !== selectedFieldId) return false;

            // Status Filter
            // Ensure plotIds is array and exists
            if (!p.plotIds || !Array.isArray(p.plotIds)) return false;

            const allPlotsDone = p.plotIds.every(pid => p.executionData?.[pid]?.executed);

            if (statusFilter === 'pending') {
                return !allPlotsDone; // Show if ANY plot is pending (not fully executed)
            } else {
                return allPlotsDone; // Show only if ALL plots are executed
            }
        }).sort((a, b) => b.createdAt - a.createdAt);
    }, [data.prescriptions, selectedCompanyId, selectedFieldId, statusFilter]);

    const handleOpenExecutionModal = (recipe: Prescription, plotId: string) => {
        setExecutingRecipe(recipe);
        setExecutingPlotId(plotId);
        setExecutionDate(new Date().toISOString().split('T')[0]);
        setObservation('');
        resetRecording();
    };

    const handleConfirmExecution = async () => {
        if (!executingRecipe || !executingPlotId || !currentUser) return;

        try {
            const executionData: PrescriptionExecution = {
                executed: true,
                executedAt: (() => {
                    const [year, month, day] = executionDate.split('-').map(Number);
                    const now = new Date();
                    const localDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
                    return localDate.toISOString();
                })(),
                executedBy: currentUser.name,
                observation: observation,
                audioDuration: audioDuration > 0 ? audioDuration : undefined
            };

            await Storage.markPrescriptionExecuted(
                executingRecipe.id,
                executingPlotId,
                executionData,
                audioBlobUrl || undefined
            );

            showNotification("Aplicación registrada exitosamente", "success");
            setExecutingRecipe(null);
            setExecutingPlotId(null);
        } catch (error) {
            console.error(error);
            showNotification("Error al registrar aplicación", "error");
        }
    };

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6 flex flex-col xl:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Modo Ejecución</h2>
                        <p className="text-xs text-gray-500">Marcar recetas como aplicadas</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-center">
                    {/* Status Toggle */}
                    <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex text-xs font-bold w-full sm:w-auto">
                        <button onClick={() => setStatusFilter('pending')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${statusFilter === 'pending' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Pendientes</button>
                        <button onClick={() => setStatusFilter('executed')} className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${statusFilter === 'executed' ? 'bg-white dark:bg-gray-600 shadow text-green-600 dark:text-green-300' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>Ejecutadas</button>
                    </div>

                    <Select
                        label=""
                        options={[{ value: '', label: 'Todas las Empresas' }, ...userCompanies.map(c => ({ value: c.id, label: c.name }))]}
                        value={selectedCompanyId}
                        onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); }}
                        className="w-full sm:w-48 text-xs h-10"
                        disabled={!!forcedCompanyId}
                    />
                    <Select
                        label=""
                        options={[{ value: '', label: 'Todos los Campos' }, ...availableFields.map(f => ({ value: f.id, label: f.name }))]}
                        value={selectedFieldId}
                        onChange={(e) => setSelectedFieldId(e.target.value)}
                        className="w-full sm:w-48 text-xs h-10"
                        disabled={!selectedCompanyId && availableFields.length === 0}
                    />
                </div>
            </div>

            {/* Content using filteredRecipes directly */}
            {filteredRecipes.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/10 rounded-xl border border-gray-100 dark:border-gray-900/30">
                    <Filter className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No se encontraron recetas {statusFilter === 'pending' ? 'pendientes' : 'ejecutadas'}.</p>
                    {(selectedCompanyId || selectedFieldId) && <p className="text-xs text-gray-400 mt-1">Prueba quitando los filtros de Empresa/Campo.</p>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRecipes.map(recipe => (
                        <div key={recipe.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col animate-fade-in group hover:shadow-md transition-shadow">
                            {/* Recipe Header */}
                            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-400 uppercase">{new Date(recipe.createdAt).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-gray-400 font-medium">
                                            {data.fields.find(f => f.id === recipe.fieldId)?.name || 'Campo'}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusFilter === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {statusFilter === 'pending' ? 'PENDIENTE' : 'EJECUTADA'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
                                    {recipe.items.map(i => i.supplyName).join(', ')}
                                </h3>
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Info className="w-3 h-3" />
                                    <span>{recipe.items.length} Insumos • {recipe.taskNames.join(', ')}</span>
                                </div>
                            </div>

                            {/* Lots List */}
                            <div className="p-4 flex-1">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> Estado por Lote
                                </h4>
                                <div className="space-y-2">
                                    {recipe.plotIds.map(pid => {
                                        const pName = recipe.plotNames[recipe.plotIds.indexOf(pid)] || 'Desconocido';
                                        const isexecuted = recipe.executionData?.[pid]?.executed;
                                        const executionDetails = recipe.executionData?.[pid];

                                        return (
                                            <div key={pid} className={`flex justify-between items-start p-3 rounded-lg border transition-colors ${isexecuted ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 items-center'}`}>
                                                <div>
                                                    <span className={`block font-medium text-sm ${isexecuted ? 'text-green-800 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>{pName}</span>
                                                    {recipe.plotMetadata?.[pid]?.observation && (
                                                        <span className="text-[10px] text-gray-500 italic block">"{recipe.plotMetadata[pid].observation}"</span>
                                                    )}
                                                    {recipe.plotMetadata?.[pid]?.affectedHectares && (
                                                        <span className="text-[10px] text-blue-600 block">{recipe.plotMetadata[pid].affectedHectares} ha</span>
                                                    )}
                                                </div>

                                                {isexecuted ? (
                                                    <div className="flex flex-col items-end gap-1 text-right max-w-[60%]">
                                                        <div className="flex items-center gap-1 text-green-700 dark:text-green-400 font-bold text-xs">
                                                            <span>{new Date(executionDetails?.executedAt || '').toLocaleDateString()}</span>
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">por {executionDetails?.executedBy || 'Desconocido'}</span>

                                                        {executionDetails?.observation && (
                                                            <div className="bg-white dark:bg-gray-800/50 px-2 py-1 rounded border border-green-100 dark:border-green-800 shadow-sm mt-1">
                                                                <p className="text-[10px] text-gray-600 dark:text-gray-400 italic">"{executionDetails.observation}"</p>
                                                            </div>
                                                        )}

                                                        {executionDetails?.audioUrl && (
                                                            <div className="mt-1">
                                                                <button
                                                                    onClick={() => setPlayingAudioId(playingAudioId === pid ? null : pid)}
                                                                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-all ${playingAudioId === pid ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                                                >
                                                                    {playingAudioId === pid ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                                                    {playingAudioId === pid ? 'Pausar Nota' : 'Escuchar Nota'}
                                                                </button>
                                                                {playingAudioId === pid && (
                                                                    <audio src={executionDetails.audioUrl} autoPlay onEnded={() => setPlayingAudioId(null)} className="hidden" />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenExecutionModal(recipe, pid)}
                                                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors shadow-sm self-center"
                                                    >
                                                        Marcar HECHO
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer */}
                            {recipe.notes && (
                                <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/10 text-xs text-gray-600 dark:text-gray-400 border-t border-yellow-100 dark:border-yellow-900/30">
                                    <span className="font-bold">Nota:</span> {recipe.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Execution Modal */}
            {executingRecipe && executingPlotId && (
                <Modal
                    isOpen={!!executingRecipe}
                    onClose={() => setExecutingRecipe(null)}
                    title="Registrar Aplicación"
                >
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                            <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">
                                {executingRecipe.plotNames[executingRecipe.plotIds.indexOf(executingPlotId)]}
                            </h4>
                            <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                Confirmar que se aplicó la receta correctamente.
                            </p>
                        </div>

                        <Input
                            label="Fecha de Aplicación"
                            type="date"
                            value={executionDate}
                            onChange={(e) => setExecutionDate(e.target.value)}
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Observaciones (Opcional)</label>
                            <textarea
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-sm h-20 resize-none"
                                placeholder="Ej: Viento fuerte, se aplicó solo la mitad..."
                                value={observation}
                                onChange={(e) => setObservation(e.target.value)}
                            />
                        </div>

                        {/* Audio Recorder Reuse */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota de Voz (Opcional)</label>
                            {!isRecording && !audioBlobUrl ? (
                                <button onClick={toggleRecording} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-50">
                                    <Mic className="w-4 h-4" /> Grabar Reporte
                                </button>
                            ) : (
                                <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100">
                                    {isRecording ? (
                                        <span className="text-red-600 text-sm font-bold flex-1">Grabando... {Math.round(audioDuration)}s</span>
                                    ) : (
                                        <span className="text-gray-700 text-sm font-bold flex-1">Audio Listo ({Math.round(audioDuration)}s)</span>
                                    )}
                                    <button onClick={toggleRecording} className="text-sm font-bold px-3 py-1 bg-white border rounded shadow-sm">
                                        {isRecording ? 'Parar' : 'Re-grabar'}
                                    </button>
                                    {audioBlobUrl && !isRecording && (
                                        <button onClick={resetRecording} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="secondary" onClick={() => setExecutingRecipe(null)}>Cancelar</Button>
                            <Button onClick={handleConfirmExecution} className="bg-green-600 text-white hover:bg-green-700">
                                Confirmar Hecho <CheckCircle2 className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
