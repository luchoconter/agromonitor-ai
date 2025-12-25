
import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, WifiOff, MapPin, Camera, StopCircle, Mic, ArrowDown, Flag, ShieldCheck, Sprout, Leaf, Flower, Minus, Plus } from 'lucide-react';
import { Select, Button, MultiSelect, Modal } from '../components/UI';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useGPS } from '../hooks/useGPS';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { useMonitoringForm } from '../hooks/useMonitoringForm';
import { useLotSummary } from '../hooks/useLotSummary';

// --- PHENOLOGY SELECTOR COMPONENT ---
const PhenologySelector: React.FC<{ 
    value: string; 
    onChange: (val: string) => void; 
}> = ({ value, onChange }) => {
    // Parse current value (e.g. "V3", "R1", "Barbecho")
    const type = value.startsWith('V') ? 'V' : (value.startsWith('R') ? 'R' : (value === 'Barbecho' ? 'Barbecho' : ''));
    const numVal = parseInt(value.slice(1)) || 0;
    const [stageNum, setStageNum] = useState(numVal);

    useEffect(() => {
        if (value.startsWith('V') || value.startsWith('R')) {
            setStageNum(parseInt(value.slice(1)) || 0);
        }
    }, [value]);

    const handleTypeSelect = (t: string) => {
        if (t === 'Barbecho') {
            onChange('Barbecho');
        } else {
            // Default to 1 when switching types if no number exists
            const newNum = stageNum === 0 ? 1 : stageNum;
            setStageNum(newNum);
            onChange(`${t}${newNum}`);
        }
    };

    const handleNumChange = (delta: number) => {
        if (!type || type === 'Barbecho') return;
        const newNum = Math.max(0, stageNum + delta); // Allow 0 (Ve/Re equivalent)
        setStageNum(newNum);
        onChange(`${type}${newNum}`);
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
                <Sprout className="w-4 h-4 text-agro-600 dark:text-agro-400" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Estadio del Cultivo</span>
            </div>
            
            <div className="flex flex-col gap-3">
                {/* Type Selector */}
                <div className="flex gap-2">
                    <button 
                        type="button"
                        onClick={() => handleTypeSelect('V')}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${type === 'V' ? 'bg-green-100 text-green-700 border-2 border-green-500 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'}`}
                    >
                        <Leaf className="w-4 h-4 mb-1" />
                        Vegetativo
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleTypeSelect('R')}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${type === 'R' ? 'bg-amber-100 text-amber-700 border-2 border-amber-500 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'}`}
                    >
                        <Flower className="w-4 h-4 mb-1" />
                        Reproductivo
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleTypeSelect('Barbecho')}
                        className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all ${type === 'Barbecho' ? 'bg-gray-200 text-gray-700 border-2 border-gray-400' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'}`}
                    >
                        <Minus className="w-4 h-4 mb-1" />
                        Barbecho
                    </button>
                </div>

                {/* Stage Slider (Only if V or R) */}
                {(type === 'V' || type === 'R') && (
                    <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-600 animate-fade-in">
                        <button 
                            type="button" 
                            onClick={() => handleNumChange(-1)} 
                            className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 active:scale-95 transition-transform"
                        >
                            <Minus className="w-5 h-5" />
                        </button>
                        
                        <div className="text-center w-24">
                            <span className={`text-3xl font-black ${type === 'V' ? 'text-green-600' : 'text-amber-500'}`}>
                                {type}{stageNum}
                            </span>
                        </div>

                        <button 
                            type="button" 
                            onClick={() => handleNumChange(1)} 
                            className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 active:scale-95 transition-transform"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const HomeView: React.FC = () => {
  const { data, userCompanies, dataOwnerId, dataOwnerName } = useData();
  const { selection, setSelection, setView, editingMonitoringId, setEditingMonitoringId, showNotification } = useUI();
  const { currentUser } = useAuth();

  // --- 1. Navigation & Context Logic ---
  const { currentLocation, gpsStatus } = useGPS();
  
  // Auto-Select Active Season
  useEffect(() => {
    if (!selection.seasonId && data.seasons.length > 0) {
        const activeSeason = data.seasons.find(s => s.isActive);
        if (activeSeason) {
            setSelection({ ...selection, seasonId: activeSeason.id });
        }
    }
  }, [data.seasons, selection.seasonId]);

  const isContextReady = selection.companyId && selection.fieldId && selection.plotId && selection.seasonId;
  const currentPlot = data.plots.find(p => p.id === selection.plotId);
  const currentAssignment = data.assignments.find(a => a.plotId === selection.plotId && a.seasonId === selection.seasonId);
  const currentCrop = data.crops.find(c => c.id === currentAssignment?.cropId);

  // Sample Number Calculation
  const todaysSamples = data.monitorings.filter(m => 
      m.plotId === selection.plotId && 
      m.seasonId === selection.seasonId && 
      new Date(m.date).toDateString() === new Date().toDateString()
  );
  console.log('🔢 todaysSamples:', todaysSamples.length, 'muestreos encontrados', todaysSamples.map(m => `M${m.sampleNumber}`).join(', '));
  
  const nextSampleNumber = todaysSamples.length > 0 
      ? Math.max(...todaysSamples.map(m => m.sampleNumber || 0)) + 1 
      : 1;
  console.log('➡️ nextSampleNumber calculado:', nextSampleNumber);
  
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
          if (editingMonitoringId) setView('history'); // Navigate away if editing
          recorder.resetRecording();
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  });

  // --- 4. Lot Summary Logic (Custom Hook) ---
  const summary = useLotSummary({
      currentUser,
      dataOwnerId,
      dataOwnerName,
      selection,
      showNotification,
      onSuccess: () => {
          recorder.resetRecording();
          setSelection({ ...selection, plotId: null });
      }
  });

  // --- Handlers (Bridge between UI and Hooks) ---
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

  const handleCleanLot = () => {
      // One-Tap submission for "Sin Novedades"
      form.submitCleanMonitoring(
          currentLocation,
          currentSampleNumber || 1
      );
  };

  const handleFinishLot = () => {
      // Ensure we submit the audio recorded inside the modal
      summary.submitSummary(recorder.audioBlobUrl, recorder.audioDuration);
  };

  const handleOpenSummary = () => {
      recorder.resetRecording();
      summary.openModal();
  };

  const availableFields = data.fields.filter(f => f.companyId === selection.companyId);
  const availablePlots = data.plots.filter(p => p.fieldId === selection.fieldId);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      
      {/* CONTEXTO */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select label="" placeholder="Empresa..." options={userCompanies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))} value={selection.companyId || ''} onChange={(e) => setSelection({ companyId: e.target.value, fieldId: null, plotId: null, seasonId: selection.seasonId })} className="py-1.5 text-sm" />
          <Select label="" placeholder="Campo..." options={availableFields.sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ value: f.id, label: f.name }))} value={selection.fieldId || ''} onChange={(e) => setSelection({ ...selection, fieldId: e.target.value, plotId: null })} disabled={!selection.companyId} className="py-1.5 text-sm" />
          <Select label="" placeholder="Lote..." options={availablePlots.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id, label: p.name }))} value={selection.plotId || ''} onChange={(e) => setSelection({ ...selection, plotId: e.target.value })} disabled={!selection.fieldId} className="py-1.5 text-sm" />
          <Select label="" placeholder="Campaña..." options={data.seasons.sort((a, b) => a.name.localeCompare(b.name)).map(s => ({ value: s.id, label: s.name }))} value={selection.seasonId || ''} onChange={(e) => setSelection({ ...selection, seasonId: e.target.value })} className="py-1.5 text-sm" />
        </div>
      </div>

      {isContextReady ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-agro-100 dark:border-gray-700 overflow-hidden animate-fade-in">
            {/* HEADER */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                     <span className="bg-agro-100 dark:bg-agro-900 text-agro-700 dark:text-agro-300 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide">
                        Muestra #{currentSampleNumber}
                     </span>
                </div>
                {!editingMonitoringId && (
                    <button type="button" onClick={handleOpenSummary} className="text-xs font-bold text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 px-3 py-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center">
                        <Flag className="w-3.5 h-3.5 mr-1.5" /> TERMINAR
                    </button>
                )}
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* INFO BAR */}
                <div className="bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-lg text-xs flex items-center justify-between gap-2">
                    <div className="flex gap-2 sm:gap-3 whitespace-nowrap">
                         <span>Cultivo: <b>{currentCrop?.name || '-'}</b></span>
                         <span>Has: <b>{currentPlot?.hectares || '-'}</b></span>
                    </div>
                    <div className="whitespace-nowrap">
                        {editingMonitoringId ? (
                            <span className="flex items-center text-blue-600 dark:text-blue-400 font-bold"><MapPin className="w-3 h-3 mr-1" /> Original</span>
                        ) : currentLocation ? (
                            <span className="flex items-center text-green-600 dark:text-green-400 font-bold"><MapPin className="w-3 h-3 mr-1" /> GPS: ±{Math.round(currentLocation.accuracy)}m</span>
                        ) : gpsStatus === 'error' ? (
                             <span className="flex items-center text-red-500 font-bold"><MapPin className="w-3 h-3 mr-1" /> Sin Señal</span>
                        ) : (
                            <span className="flex items-center text-amber-500 font-bold animate-pulse"><MapPin className="w-3 h-3 mr-1" /> Buscando...</span>
                        )}
                    </div>
                </div>

                {/* NEW: PHENOLOGY SELECTOR */}
                <PhenologySelector value={form.phenology} onChange={form.setPhenology} />

                {/* FORM CONTROLS */}
                <div><MultiSelect label="Plagas Detectadas" options={data.pests.sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id, label: p.name }))} selectedValues={form.selectedPestIds} onChange={form.handlePestChange} placeholder="Seleccionar plagas..." /></div>

                {form.selectedPestIds.length > 0 && (
                    <div className="space-y-2 border-t border-b border-gray-100 dark:border-gray-700 py-3">
                        {form.selectedPestIds.map(pestId => {
                            const pest = data.pests.find(p => p.id === pestId);
                            if (!pest) return null;
                            const unitLower = (pest.defaultUnit || '').toLowerCase();
                            const isQualitative = unitLower.includes('alta') || unitLower.includes('media') || unitLower.includes('concentracion');
                            return (
                                <div key={pestId} className="flex flex-row items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-100 dark:border-gray-800">
                                    <div className="flex-1 min-w-0"><span className="font-semibold text-gray-800 dark:text-gray-200 block text-xs truncate">{pest.name}</span><span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">{pest.defaultUnit || '-'}</span></div>
                                    <div className="shrink-0">
                                        {isQualitative ? (
                                            <div className="flex rounded-md shadow-sm h-7" role="group">
                                                {['Baja', 'Media', 'Alta'].map((level) => {
                                                    const isSelected = form.pestValues[pestId] === level;
                                                    return (<button key={level} type="button" onClick={() => form.handlePestValueChange(pestId, level)} className={`w-12 px-1 py-0 text-[9px] font-medium border first:rounded-l-lg last:rounded-r-lg focus:z-10 focus:ring-1 focus:ring-agro-500 transition-colors h-full flex items-center justify-center ${isSelected ? 'bg-agro-600 text-white border-agro-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200'}`}>{level}</button>);
                                                })}
                                            </div>
                                        ) : (
                                            <input type="number" placeholder="0" className="w-16 px-2 py-1 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:ring-2 focus:ring-agro-500 outline-none text-right" value={form.pestValues[pestId] || ''} onChange={(e) => form.handlePestValueChange(pestId, e.target.value)} required />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-24 flex items-center justify-center relative bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 transition-colors">
                        {form.photoUrl ? <img src={form.photoUrl} className="absolute inset-0 w-full h-full object-cover rounded-xl" /> : <div className="flex flex-col items-center text-gray-400"><Camera className="w-6 h-6 mb-1" /><span className="text-[10px]">Foto</span></div>}
                        <input type="file" accept="image/*" capture="environment" onChange={form.handlePhotoSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <div className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-24 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 cursor-pointer transition-colors ${recorder.isRecording ? 'border-red-500 bg-red-50' : ''}`} onClick={recorder.toggleRecording}>
                        {recorder.isRecording ? <div className="flex flex-col items-center animate-pulse text-red-500"><StopCircle className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">{recorder.audioDuration}s</span></div> : <div className="flex flex-col items-center text-gray-400"><Mic className={`w-6 h-6 mb-1 ${(recorder.hasAudio || (editingMonitoringId && data.monitorings.find(m => m.id === editingMonitoringId)?.media?.hasAudio)) ? 'text-green-500' : ''}`} /><span className="text-[10px]">{(recorder.hasAudio || (editingMonitoringId && data.monitorings.find(m => m.id === editingMonitoringId)?.media?.hasAudio)) ? 'Audio OK' : 'Audio'}</span></div>}
                    </div>
                </div>

                <div><textarea value={form.observationText} onChange={(e) => form.setObservationText(e.target.value)} className="w-full rounded-lg p-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-agro-500 outline-none" placeholder="Observaciones..." rows={2}></textarea></div>

                <div className="pt-2 flex gap-3">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        className="flex-1 h-12 text-sm font-bold border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                        onClick={() => {
                            form.resetForm();
                            recorder.resetRecording();
                            setEditingMonitoringId(null);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        CANCELAR
                    </Button>
                    <Button type="submit" className="flex-[2] h-12 text-base font-bold shadow-lg shadow-agro-600/20" isLoading={form.isSubmitting}>
                        {editingMonitoringId ? "ACTUALIZAR" : "GUARDAR"}
                    </Button>
                </div>
            </form>
        </div>
      ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600"><ArrowDown className="w-8 h-8 mb-2 animate-bounce opacity-50" /><p className="text-sm">Seleccione contexto para comenzar</p></div>
      )}

        <Modal isOpen={summary.isOpen} onClose={summary.closeModal} title="Guardar y Terminar Lote">
            <div className="space-y-6">
                <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 p-3 rounded-lg text-sm">
                    <p className="font-semibold text-gray-500 dark:text-gray-400 uppercase text-xs mb-1">Contexto</p>
                    <div className="flex items-center space-x-2"><span className="font-bold">{data.plots.find(p => p.id === selection.plotId)?.name || 'Seleccione Lote'}</span></div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estado General del Lote</label>
                    <div className="grid grid-cols-3 gap-2">
                        {['verde', 'amarillo', 'rojo'].map((s) => (<button key={s} onClick={() => summary.setStatus(s as any)} className={`p-3 rounded-lg border-2 font-bold text-sm uppercase ${summary.status === s ? (s === 'verde' ? 'border-green-500 bg-green-50 text-green-700' : s === 'amarillo' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-gray-200 text-gray-500 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600'}`}>{s}</button>))}
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className={`flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-24 flex items-center justify-center bg-gray-50 dark:bg-gray-800 cursor-pointer transition-colors ${recorder.isRecording ? 'border-red-500 bg-red-50' : ''}`} onClick={recorder.toggleRecording}>
                        {recorder.isRecording ? <div className="flex flex-col items-center animate-pulse text-red-500"><StopCircle className="w-8 h-8 mb-1" /><span className="text-xs font-bold">Grabar ({recorder.audioDuration}s)</span></div> : <div className="flex flex-col items-center text-gray-400"><Mic className={`w-8 h-8 mb-1 ${recorder.audioDuration > 0 ? 'text-green-500' : ''}`} /><span className="text-xs">{recorder.audioDuration > 0 ? 'Audio Grabado' : 'Grabar Nota de Voz'}</span></div>}
                    </div>
                </div>
                <textarea value={summary.notes} onChange={(e) => summary.setNotes(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-agro-500 outline-none h-24 resize-none" placeholder="Escribir nota de cierre..." />
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={summary.closeModal}>Cancelar</Button>
                    <Button onClick={handleFinishLot} disabled={!summary.status || summary.isSubmitting} isLoading={summary.isSubmitting}>Finalizar y Salir</Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};
