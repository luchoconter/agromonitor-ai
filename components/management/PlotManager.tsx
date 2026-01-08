import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Filter, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ArrowLeft, AlertTriangle, Map as MapIcon, List } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { PlotMapView } from './PlotMapView';
import { Plot, Field, Company } from '../../types';
import * as Storage from '../../services/storageService';
import * as DeepDelete from '../../services/deepDeleteService';
import { useData } from '../../contexts/DataContext';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';

interface PlotManagerProps {
    plots: Plot[];
    fields: Field[];
    companies: Company[];
}

export const PlotManager: React.FC<PlotManagerProps> = ({ plots, fields, companies }) => {
    const { dataOwnerId, dataOwnerName } = useData();
    const { currentUser } = useAuth();

    // View Mode
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingPlotId, setEditingPlotId] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompanyId, setFilterCompanyId] = useState('');
    const [filterFieldId, setFilterFieldId] = useState('');

    // Form Data (Single)
    const [formData, setFormData] = useState({ name: '', hectares: '', fieldId: '', companyId: '', lat: '', lng: '' });

    // Import Data
    type ImportedPlot = {
        companyName: string;
        fieldName: string;
        name: string;
        hectares: number;
        lat?: number;
        lng?: number;
    };
    const [importData, setImportData] = useState<ImportedPlot[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // Helper for DMS parsing
    const parseDMS = (dmsStr: any): number | undefined => {
        if (!dmsStr || typeof dmsStr !== 'string') return undefined;
        const trimmed = dmsStr.trim();
        const regex = /(\d+)°\s*(\d+)'\s*([\d.]+)"\s*([NSEOW])/i;
        const match = trimmed.match(regex);
        if (!match) return undefined;
        const deg = parseFloat(match[1]);
        const min = parseFloat(match[2]);
        const sec = parseFloat(match[3]);
        const dir = match[4].toUpperCase();
        let dd = deg + min / 60 + sec / 3600;
        if (dir === 'S' || dir === 'O' || dir === 'W') dd = dd * -1;
        return dd;
    };

    // Delete State
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [deleteStep, setDeleteStep] = useState<1 | 2>(1); // Step 1: Warning, Step 2: Password

    // --- FILTER LOGIC ---
    const availableFieldsForFilter = fields.filter(f => !filterCompanyId || f.companyId === filterCompanyId);

    const filteredItems = plots.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Complex Hierarchy Match
        let matchesHierarchy = true;
        if (filterCompanyId) {
            if (item.companyId && item.companyId !== filterCompanyId) matchesHierarchy = false;
            else if (!item.companyId) {
                const f = fields.find(f => f.id === item.fieldId);
                if (f && f.companyId !== filterCompanyId) matchesHierarchy = false;
            }
        }
        if (filterFieldId && item.fieldId !== filterFieldId) matchesHierarchy = false;

        return matchesSearch && matchesHierarchy;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    // --- CRUD HANDLERS ---
    const openAdd = () => {
        setEditingPlotId(null);
        setFormData({
            name: '',
            hectares: '',
            fieldId: filterFieldId || '',
            companyId: filterCompanyId || '',
            lat: '',
            lng: ''
        });
        setIsModalOpen(true);
    };

    const openEdit = (item: Plot) => {
        setEditingPlotId(item.id);
        // Find company if not directly on plot
        let compId = item.companyId;
        if (!compId) {
            const f = fields.find(f => f.id === item.fieldId);
            compId = f?.companyId;
        }
        setFormData({
            name: item.name,
            hectares: item.hectares.toString(),
            fieldId: item.fieldId,
            companyId: compId || '',
            lat: item.lat ? item.lat.toString() : '',
            lng: item.lng ? item.lng.toString() : ''
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setConfirmPassword('');
        setPasswordError('');
        setDeleteStep(1); // Reset to Step 1
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!deleteId || !currentUser) return;

        if (confirmPassword !== currentUser.password) {
            setPasswordError('Contraseña incorrecta');
            return;
        }

        setIsDeleting(true);
        try {
            await DeepDelete.deepDeletePlot(deleteId);
            setDeleteId(null);
        } catch (error) {
            console.error("Error deleting plot:", error);
            alert("Ocurrió un error al eliminar el lote.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.fieldId || !dataOwnerId) return;

        const field = fields.find(f => f.id === formData.fieldId);
        const companyId = field?.companyId || formData.companyId;

        const lat = formData.lat ? parseFloat(formData.lat) : undefined;
        const lng = formData.lng ? parseFloat(formData.lng) : undefined;

        if (editingPlotId) {
            await Storage.updatePlot(editingPlotId, formData.name, Number(formData.hectares), formData.fieldId, companyId, lat, lng);
        } else {
            await Storage.addPlot(formData.name, formData.fieldId, Number(formData.hectares), dataOwnerId, dataOwnerName, companyId, lat, lng);
        }
        setIsModalOpen(false);
    };

    const handleSaveAndContinue = async () => {
        if (!formData.name.trim() || !formData.fieldId || !dataOwnerId) return;

        const field = fields.find(f => f.id === formData.fieldId);
        const companyId = field?.companyId || formData.companyId;

        const lat = formData.lat ? parseFloat(formData.lat) : undefined;
        const lng = formData.lng ? parseFloat(formData.lng) : undefined;

        await Storage.addPlot(formData.name, formData.fieldId, Number(formData.hectares), dataOwnerId, dataOwnerName, companyId, lat, lng);
        setFormData(prev => ({ ...prev, name: '', hectares: '', lat: '', lng: '' }));
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        const processRow = (row: any) => {
            const companyName = row['NombreEmpresa'] || row['Empresa'] || '';
            const fieldName = row['NombreCampo'] || row['Campo'] || '';
            const plotName = row['NombreLote'] || row['Lote'] || row['Nombre'] || '';

            let hectares = 0;
            const hasVal = row['has'] || row['Has'] || row['Hectareas'] || 0;
            if (typeof hasVal === 'number') hectares = hasVal;
            else hectares = parseFloat(String(hasVal).replace(',', '.')) || 0;

            const latStr = row['Latitud'] || row['Lat'] || '';
            const lngStr = row['Longitud'] || row['Lng'] || row['Long'] || '';

            const lat = parseDMS(latStr);
            const lng = parseDMS(lngStr);

            if (plotName) {
                return {
                    companyName: String(companyName).trim(),
                    fieldName: String(fieldName).trim(),
                    name: String(plotName).trim(),
                    hectares,
                    lat,
                    lng
                };
            }
            return null;
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.onload = (event) => {
                const data = event.target?.result;
                try {
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

                    const parsed: ImportedPlot[] = [];
                    jsonData.forEach(row => {
                        const p = processRow(row);
                        if (p) parsed.push(p);
                    });
                    setImportData(parsed);
                } catch (error) {
                    console.error("Error parsing Excel:", error);
                    alert("Error al leer el archivo Excel.");
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            console.warn("CSV not fully supported for hierarchical import in this version. Please use Excel.");
            alert("Por favor utilice formato Excel (.xlsx) para importar jerarquías completas.");
        }
    };

    const handleConfirmImport = async () => {
        if (importData.length === 0 || !dataOwnerId) return;
        setIsImporting(true);

        try {
            const hierarchy: Record<string, Record<string, ImportedPlot[]>> = {};

            importData.forEach(p => {
                const cName = p.companyName || 'Sin Empresa';
                const fName = p.fieldName || 'Sin Campo';
                if (!hierarchy[cName]) hierarchy[cName] = {};
                if (!hierarchy[cName][fName]) hierarchy[cName][fName] = [];
                hierarchy[cName][fName].push(p);
            });

            for (const companyName of Object.keys(hierarchy)) {
                let company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
                let companyId = company?.id;

                if (!companyId) {
                    companyId = await Storage.addCompany(companyName, dataOwnerId, dataOwnerName);
                }

                if (!companyId) continue;

                const fieldsMap = hierarchy[companyName];
                for (const fieldName of Object.keys(fieldsMap)) {
                    let field = fields.find(f => f.name.toLowerCase() === fieldName.toLowerCase() && f.companyId === companyId);
                    let fieldId = field?.id;

                    if (!fieldId) {
                        fieldId = await Storage.addField(fieldName, companyId, dataOwnerId, dataOwnerName);
                    }

                    if (!fieldId) continue;

                    const plotsToAdd = fieldsMap[fieldName];
                    for (const plotData of plotsToAdd) {
                        const existingPlot = plots.find(p => p.fieldId === fieldId && p.name.toLowerCase() === plotData.name.toLowerCase());

                        if (!existingPlot) {
                            await Storage.addPlot(plotData.name, fieldId, plotData.hectares, dataOwnerId, dataOwnerName, companyId, plotData.lat || undefined, plotData.lng || undefined);
                        }
                    }
                }
            }

            alert(`${importData.length} registros procesados.`);
            setIsImportModalOpen(false);
            setImportData([]);
        } catch (e) {
            console.error(e);
            alert("Error al importar lotes.");
        } finally {
            setIsImporting(false);
        }
    };

    const availableFormFields = fields.filter(f => !formData.companyId || f.companyId === formData.companyId);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 bg-gray-50/50 dark:bg-gray-900/50">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Lotes</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plots.length} registros</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-200 dark:border-gray-700 sm:justify-end">
                    {/* View Toggle */}
                    <Button
                        variant="outline"
                        onClick={() => setViewMode(prev => prev === 'list' ? 'map' : 'list')}
                        className={`flex items-center gap-2 ${viewMode === 'map' ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                    >
                        {viewMode === 'list' ? (
                            <><MapIcon className="w-4 h-4 mr-2" /> Ver Mapa</>
                        ) : (
                            <><List className="w-4 h-4 mr-2" /> Ver Lista</>
                        )}
                    </Button>

                    <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}><FileSpreadsheet className="w-4 h-4 mr-2" />Importar</Button>
                    <Button onClick={openAdd} disabled={fields.length === 0}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
                </div>
            </div>

            {/* CONTENT: EITHER LIST OR MAP */}
            {viewMode === 'list' ? (
                <>
                    {/* Filters */}
                    <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1">
                                <Select label="" placeholder="Todas las Empresas..." options={companies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={filterCompanyId} onChange={(e) => { setFilterCompanyId(e.target.value); setFilterFieldId(''); }} className="text-sm" />
                            </div>
                            <div className="flex-1">
                                <Select label="" placeholder="Todos los Campos..." options={availableFieldsForFilter.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={filterFieldId} onChange={(e) => setFilterFieldId(e.target.value)} disabled={!filterCompanyId && companies.length > 0} className="text-sm" />
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input type="text" placeholder="Buscar lote..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none transition-all text-sm dark:text-gray-200" />
                            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        {fields.length === 0 ? (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg flex items-center border border-amber-100 dark:border-amber-800/50"><span>Cree un Campo primero.</span></div>
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl"><Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />No se encontraron lotes.</div>
                        ) : (
                            filteredItems.map(item => {
                                const field = fields.find(f => f.id === item.fieldId);
                                const company = companies.find(c => c.id === item.companyId) || (field ? companies.find(c => c.id === field.companyId) : null);
                                return (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
                                        <div>
                                            <span className="font-semibold text-gray-800 dark:text-gray-200 block">{item.name} <span className="text-gray-400 font-normal text-xs ml-2">({item.hectares} Has)</span></span>
                                            <div className="flex gap-1 mt-1">
                                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{company?.name}</span>
                                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{field?.name}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            ) : (
                <PlotMapView
                    plots={plots}
                    companies={companies}
                    fields={fields}
                    onUpdatePlot={async (id, lat, lng) => {
                        const p = plots.find(x => x.id === id);
                        if (p) {
                            const field = fields.find(f => f.id === p.fieldId);
                            const companyId = field?.companyId || p.companyId;
                            await Storage.updatePlot(id, p.name, p.hectares, p.fieldId, companyId, lat, lng);
                        }
                    }}
                />
            )}

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPlotId ? "Editar Lote" : "Nuevo Lote"}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Select label="Empresa" options={companies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={formData.companyId} onChange={e => setFormData({ ...formData, companyId: e.target.value, fieldId: '' })} required placeholder="Seleccionar Empresa" />
                    <Select label="Campo" options={availableFormFields.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={formData.fieldId} onChange={e => setFormData({ ...formData, fieldId: e.target.value })} required disabled={!formData.companyId} placeholder="Seleccionar Campo" />
                    <Input label="Nombre del Lote" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus required />
                    <div className="grid grid-cols-2 gap-3">
                        <Input label="Hectáreas" type="number" value={formData.hectares} onChange={e => setFormData({ ...formData, hectares: e.target.value })} placeholder="0" />
                        <div className="flex gap-2">
                            <Input label="Latitud" type="number" step="any" value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })} placeholder="-34.xxx" />
                            <Input label="Longitud" type="number" step="any" value={formData.lng} onChange={e => setFormData({ ...formData, lng: e.target.value })} placeholder="-58.xxx" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="order-3 sm:order-1">Cancelar</Button>

                        {!editingPlotId && (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleSaveAndContinue}
                                disabled={!formData.name.trim() || !formData.fieldId}
                                className="order-2 sm:order-2"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Guardar y Otro
                            </Button>
                        )}

                        <Button type="submit" className="order-1 sm:order-3">Guardar</Button>
                    </div>
                </form>
            </Modal>

            {/* Import Modal */}
            <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Lotes (Excel)">
                <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
                        <div className="flex items-center gap-2 mb-2 font-bold"><AlertCircle className="w-4 h-4" /> Formato Requerido (Estricto)</div>
                        <p>El archivo Excel debe contener las siguientes columnas exactas:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                            <li><strong>NombreEmpresa</strong></li>
                            <li><strong>NombreCampo</strong></li>
                            <li><strong>NombreLote</strong></li>
                            <li><strong>has</strong> (Hectáreas)</li>
                            <li><strong>Latitud</strong> (Ej: 28°44'42.78"S)</li>
                            <li><strong>Longitud</strong> (Ej: 62°14'26.32"O)</li>
                        </ul>
                    </div>

                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 relative">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">Clic para subir .xlsx o .xls</span>
                        <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    {importData.length > 0 && (
                        <div className="mt-4 max-h-40 overflow-y-auto border rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900">
                            <p className="text-xs font-bold mb-2">Previsualización ({importData.length}):</p>
                            {importData.slice(0, 10).map((d, i) => (<div key={i} className="flex justify-between border-b last:border-0 border-gray-200 dark:border-gray-700 py-1">
                                <div className="flex flex-col">
                                    <span className="font-bold">{d.name}</span>
                                    <span className="text-[10px] text-gray-500">{d.companyName} / {d.fieldName}</span>
                                    {(d.lat && d.lng) && <span className="text-[10px] text-green-600">Ubicación detectada</span>}
                                </div>
                                <span className="font-mono">{d.hectares} Has</span>
                            </div>))}
                            {importData.length > 10 && <div className="text-xs text-gray-500 text-center py-1">...y {importData.length - 10} más</div>}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmImport} disabled={isImporting || importData.length === 0}>{isImporting ? 'Procesando...' : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar e Importar</>}</Button>
                    </div>
                </div>
            </Modal>


            {/* Delete Confirmation Modal (2 Steps) */}
            <Modal isOpen={!!deleteId} onClose={() => { if (!isDeleting) setDeleteId(null); }} title={deleteStep === 1 ? "Eliminar Lote" : "Confirmación de Seguridad"}>
                <div className="space-y-4">
                    {deleteStep === 1 && (
                        <>
                            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg flex items-start gap-3 border border-orange-100 dark:border-orange-800">
                                <AlertTriangle className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
                                <div className="space-y-2">
                                    <p className="font-bold text-orange-800 dark:text-orange-300 text-sm">¿Eliminar Lote y Datos?</p>
                                    <p className="text-orange-700 dark:text-orange-400 text-sm leading-relaxed">
                                        Esta acción eliminará el lote y <strong>todo su historial operativo</strong>: monitoreos, cierres de lote, fotos y audios asociados.
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
                                <Button variant="danger" onClick={() => setDeleteStep(2)}>Sí, Continuar</Button>
                            </div>
                        </>
                    )}

                    {deleteStep === 2 && (
                        <>
                            {!isDeleting ? (
                                <>
                                    <div className="flex flex-col items-center justify-center py-2 text-center">
                                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
                                            <ShieldCheck className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 px-4">
                                            Confirme con su contraseña de administrador.
                                        </p>
                                    </div>

                                    <Input
                                        label="Contraseña"
                                        type="password"
                                        placeholder="Su contraseña"
                                        value={confirmPassword}
                                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                                        error={passwordError}
                                        autoFocus
                                    />

                                    <div className="flex justify-between items-center pt-4">
                                        <Button variant="ghost" onClick={() => setDeleteStep(1)} className="text-xs">
                                            <ArrowLeft className="w-3 h-3 mr-1" /> Volver
                                        </Button>
                                        <Button variant="danger" onClick={confirmDelete} disabled={!confirmPassword}>
                                            Eliminar
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 space-y-4">
                                    <Loader2 className="w-10 h-10 text-agro-600 dark:text-agro-400 animate-spin" />
                                    <div className="text-center">
                                        <p className="font-bold text-gray-800 dark:text-gray-200">Limpiando Lote</p>
                                        <p className="text-xs text-gray-500 mt-1">Eliminando archivos asociados...</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};
