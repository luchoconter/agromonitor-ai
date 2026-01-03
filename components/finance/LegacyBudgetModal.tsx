import React, { useState, useEffect } from 'react';
import { Budget } from '../../types/models';
import { saveBudget } from '../../services/repositories/budgetRepository';
import { X, Save, History, AlertCircle } from 'lucide-react';

interface LegacyBudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    budget: Budget; // We need the full budget object to update it
    cropName: string;
    onSave: () => void;
}

export const LegacyBudgetModal: React.FC<LegacyBudgetModalProps> = ({ isOpen, onClose, budget, cropName, onSave }) => {
    const [formData, setFormData] = useState<Budget['legacySpent']>({
        herbicidas: 0, insecticidas: 0, fungicidas: 0, fertilizantes: 0,
        coadyuvantes: 0, otrosAgroquimicos: 0, semillas: 0,
        pulverizacionTerrestre: 0, pulverizacionSelectiva: 0, pulverizacionAerea: 0,
        siembra: 0, otrasLabores: 0
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && budget.legacySpent) {
            setFormData(budget.legacySpent);
        } else if (isOpen) {
            // Reset to 0 if no legacy data
            setFormData({
                herbicidas: 0, insecticidas: 0, fungicidas: 0, fertilizantes: 0,
                coadyuvantes: 0, otrosAgroquimicos: 0, semillas: 0,
                pulverizacionTerrestre: 0, pulverizacionSelectiva: 0, pulverizacionAerea: 0,
                siembra: 0, otrasLabores: 0
            });
        }
    }, [isOpen, budget]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await saveBudget({
                ...budget,
                legacySpent: formData
            });
            onSave();
            onClose();
        } catch (error) {
            console.error("Error saving legacy budget:", error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const InputGroup = ({ label, field }: { label: string, field: keyof typeof formData }) => (
        <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full pl-6 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none
                               bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                    value={formData?.[field] || ''}
                    onChange={e => setFormData(prev => ({ ...prev!, [field]: parseFloat(e.target.value) || 0 }))}
                />
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-amber-50 dark:bg-amber-900/10">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <History className="w-5 h-5" />
                        <div>
                            <h3 className="font-bold">Saldos Iniciales / Consumo Histórico</h3>
                            <p className="text-xs opacity-80">{cropName} - Cargar lo ya ejecutado (USD/Ha)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-xs flex gap-2 items-start border border-blue-100">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>Ingrese los montos en <b>USD por Hectárea</b> que ya se han gastado antes de usar la aplicación. Estos valores se sumarán a lo calculado por las recetas.</p>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b">Insumos</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <InputGroup label="Herbicidas" field="herbicidas" />
                            <InputGroup label="Insecticidas" field="insecticidas" />
                            <InputGroup label="Fungicidas" field="fungicidas" />
                            <InputGroup label="Fertilizantes" field="fertilizantes" />
                            <InputGroup label="Coadyuvantes" field="coadyuvantes" />
                            <InputGroup label="Semillas" field="semillas" />
                            <InputGroup label="Otros" field="otrosAgroquimicos" />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 pb-1 border-b">Labores</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <InputGroup label="Siembra" field="siembra" />
                            <InputGroup label="Pulv. Terrestre" field="pulverizacionTerrestre" />
                            <InputGroup label="Pulv. Aérea" field="pulverizacionAerea" />
                            <InputGroup label="Pulv. Selectiva" field="pulverizacionSelectiva" />
                            <InputGroup label="Otras Labores" field="otrasLabores" />
                        </div>
                    </div>
                </form>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/30">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Cancelar</button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
                    >
                        {saving ? 'Guardando...' : <><Save className="w-4 h-4" /> Guardar Saldos</>}
                    </button>
                </div>
            </div>
        </div>
    );
};
