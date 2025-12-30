import React, { useState, useMemo, useEffect } from 'react';
import { Modal, Button } from '../UI'; // Adjust import path as needed
import { useData } from '../../contexts/DataContext';
import { FileText, Check, Map as MapIcon, Calendar, CheckSquare } from 'lucide-react';

interface ReportWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartGeneration: (selectedFieldIds: string[]) => void;
    preSelectedCompanyId?: string;
}

export const ReportWizardModal: React.FC<ReportWizardModalProps> = ({
    isOpen,
    onClose,
    onStartGeneration,
    preSelectedCompanyId
}) => {
    const { data, userCompanies } = useData();

    // Step 1: Company Selection (if not constrained)
    const [selectedCompanyId, setSelectedCompanyId] = useState(preSelectedCompanyId || '');

    // Step 2: Field Selection
    const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

    useEffect(() => {
        if (preSelectedCompanyId) setSelectedCompanyId(preSelectedCompanyId);
    }, [preSelectedCompanyId]);

    // Available Companies
    const companies = useMemo(() => userCompanies, [userCompanies]);

    // Available Fields based on Company
    const availableFields = useMemo(() => {
        if (!selectedCompanyId) return [];
        return data.fields.filter(f => f.companyId === selectedCompanyId);
    }, [data.fields, selectedCompanyId]);

    const handleToggleField = (fieldId: string) => {
        setSelectedFieldIds(prev =>
            prev.includes(fieldId)
                ? prev.filter(id => id !== fieldId)
                : [...prev, fieldId]
        );
    };

    const handleSelectAll = () => {
        if (selectedFieldIds.length === availableFields.length) {
            setSelectedFieldIds([]);
        } else {
            setSelectedFieldIds(availableFields.map(f => f.id));
        }
    };

    const canStart = selectedFieldIds.length > 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Generador de Informe Profesional"
            size="lg"
        >
            <div className="space-y-6">

                {/* Intro / Context */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-blue-800">
                    <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg shrink-0 text-blue-600 dark:text-blue-200">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-900 dark:text-blue-100 text-sm">Informe de Situación Multipropósito</h4>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Esta herramienta generará un informe PDF detallado.
                            El sistema recorrerá visualmente cada campo seleccionado para capturar el mapa con el zoom exacto y compilará:
                            Situación de Lotes, Mapas, Recetas Pendientes y Resumen de Trabajo.
                        </p>
                    </div>
                </div>

                {/* Step 1: Company Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        1. Seleccionar Empresa
                    </label>
                    <select
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        value={selectedCompanyId}
                        onChange={(e) => {
                            setSelectedCompanyId(e.target.value);
                            setSelectedFieldIds([]); // Reset fields
                        }}
                        disabled={!!preSelectedCompanyId}
                    >
                        <option value="">Seleccione una empresa...</option>
                        {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Step 2: Field Selection */}
                {selectedCompanyId && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-end mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                2. Seleccionar Campos a Incluir
                            </label>
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline"
                            >
                                {selectedFieldIds.length === availableFields.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                            {availableFields.length === 0 ? (
                                <p className="text-xs text-gray-500 italic col-span-2 text-center py-4">No hay campos registrados para esta empresa.</p>
                            ) : (
                                availableFields.map(field => {
                                    const plotCount = data.plots.filter(p => p.fieldId === field.id).length;
                                    const isSelected = selectedFieldIds.includes(field.id);

                                    return (
                                        <div
                                            key={field.id}
                                            onClick={() => handleToggleField(field.id)}
                                            className={`
                                                cursor-pointer p-3 rounded-lg border transition-all flex items-center justify-between group
                                                ${isSelected
                                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 ring-1 ring-green-500/20'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                                }
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                    ${isSelected ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}
                                                `}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div>
                                                    <h5 className={`font-bold text-sm ${isSelected ? 'text-green-900 dark:text-green-100' : 'text-gray-700 dark:text-gray-200'}`}>
                                                        {field.name}
                                                    </h5>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">{plotCount} Lotes</span>
                                                </div>
                                            </div>
                                            <MapIcon className={`w-4 h-4 ${isSelected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`} />
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        onClick={() => onStartGeneration(selectedFieldIds)}
                        disabled={!canStart}
                        className={`
                            ${canStart
                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-105'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'} 
                            transition-all duration-300 font-bold px-8
                        `}
                    >
                        COMENZAR GENRACIÓN
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
