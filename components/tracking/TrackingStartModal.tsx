import React, { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';

interface TrackingStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (companyId: string | undefined, fieldIds: string[]) => void;
}

export const TrackingStartModal: React.FC<TrackingStartModalProps> = ({ isOpen, onClose, onStart }) => {
    const { data } = useData();
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedCompanyId('');
            setSelectedFieldIds([]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const companies = data?.companies || [];
    const fields = data?.fields || [];
    const filteredFields = fields.filter(f => f.companyId === selectedCompanyId);

    const handleFieldToggle = (fieldId: string) => {
        setSelectedFieldIds(prev =>
            prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
        );
    };

    const handleStart = () => {
        onStart(selectedCompanyId || undefined, selectedFieldIds);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Iniciar Ruta</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Selecciona el campo donde realizarás la ruta.</p>
                </div>

                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                        <select
                            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-agro-500 outline-none"
                            value={selectedCompanyId}
                            onChange={e => {
                                setSelectedCompanyId(e.target.value);
                                setSelectedFieldIds([]); // Reset fields
                            }}
                        >
                            <option value="">Seleccionar Empresa...</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedCompanyId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Lotes / Campos <span className="text-xs text-gray-500 font-normal">(Opcional)</span>
                            </label>
                            {filteredFields.length > 0 ? (
                                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-900/50 max-h-[200px] overflow-y-auto">
                                    {filteredFields.map(field => (
                                        <label key={field.id} className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-agro-600 rounded border-gray-300 focus:ring-agro-500"
                                                checked={selectedFieldIds.includes(field.id)}
                                                onChange={() => handleFieldToggle(field.id)}
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-200">{field.name}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No hay campos registrados en esta empresa.</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-900/30 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleStart}
                        disabled={!selectedCompanyId}
                        className="px-4 py-2 text-sm font-bold text-white bg-agro-600 hover:bg-agro-700 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Comenzar
                    </button>
                </div>
            </div>
        </div>
    );
};
