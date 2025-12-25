
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Filter, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { Plot, Field, Company } from '../../types';
import * as Storage from '../../services/storageService';
import * as DeepDelete from '../../services/deepDeleteService'; // Importar nuevo servicio
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
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<Plot | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterFieldId, setFilterFieldId] = useState('');

  // Form Data (Single)
  const [formData, setFormData] = useState({ name: '', hectares: '', fieldId: '', companyId: '' });

  // Import Data
  const [importCompanyId, setImportCompanyId] = useState('');
  const [importFieldId, setImportFieldId] = useState('');
  const [importData, setImportData] = useState<{name: string, hectares: number}[]>([]);
  const [isImporting, setIsImporting] = useState(false);

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
  }).sort((a, b) => a.name.localeCompare(b.name));

  // --- CRUD HANDLERS ---
  const openAdd = () => {
    setEditingItem(null);
    setFormData({ 
        name: '', 
        hectares: '', 
        fieldId: filterFieldId || '',
        companyId: filterCompanyId || '' 
    });
    setIsModalOpen(true);
  };

  const openEdit = (item: Plot) => {
    setEditingItem(item);
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
        companyId: compId || ''
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
          // Usar Deep Delete en lugar del delete simple
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

    if (editingItem) {
      await Storage.updatePlot(editingItem.id, formData.name, Number(formData.hectares), formData.fieldId, companyId);
    } else {
      await Storage.addPlot(formData.name, formData.fieldId, Number(formData.hectares), dataOwnerId, dataOwnerName, companyId);
    }
    setIsModalOpen(false);
  };

  // --- NEW: SAVE AND CONTINUE ---
  const handleSaveAndContinue = async () => {
    if (!formData.name.trim() || !formData.fieldId || !dataOwnerId) return;

    const field = fields.find(f => f.id === formData.fieldId);
    const companyId = field?.companyId || formData.companyId;

    // 1. Guardar
    await Storage.addPlot(formData.name, formData.fieldId, Number(formData.hectares), dataOwnerId, dataOwnerName, companyId);
    
    // 2. Feedback visual (Vaciar campos indica éxito)
    setFormData(prev => ({ ...prev, name: '', hectares: '' }));
    
    // No cerramos el modal
  };

  // --- IMPORT HANDLERS ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      // EXCEL HANDLING (.xlsx, .xls)
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          reader.onload = (event) => {
              const data = event.target?.result;
              try {
                  const workbook = XLSX.read(data, { type: 'array' });
                  const firstSheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[firstSheetName];
                  
                  // Convert sheet to array of arrays
                  // header: 1 creates an array of arrays [[row1], [row2], ...]
                  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
                  
                  const parsed: {name: string, hectares: number}[] = [];

                  // Start from index 1 assuming row 0 is header
                  for (let i = 1; i < jsonData.length; i++) {
                      const row = jsonData[i];
                      if (row && row.length > 0 && row[0]) {
                          const name = String(row[0]).trim();
                          let has = 0;
                          
                          // Handle hectares column (index 1)
                          if (row[1]) {
                              if (typeof row[1] === 'number') {
                                  has = row[1];
                              } else {
                                  // Replace comma with dot if string
                                  const hasStr = String(row[1]).replace(',', '.').trim();
                                  has = parseFloat(hasStr) || 0;
                              }
                          }
                          
                          if (name) parsed.push({ name, hectares: has });
                      }
                  }
                  setImportData(parsed);

              } catch (error) {
                  console.error("Error parsing Excel:", error);
                  alert("Error al leer el archivo Excel. Asegúrese de que el formato sea correcto.");
              }
          };
          reader.readAsArrayBuffer(file);
      } else {
          // CSV HANDLING
          reader.onload = (event) => {
              const text = event.target?.result as string;
              parseCSV(text);
          };
          reader.readAsText(file);
      }
  };

  const parseCSV = (text: string) => {
      const lines = text.split(/\r\n|\n/);
      const parsed: {name: string, hectares: number}[] = [];
      const firstLine = lines[0] || '';
      const separator = firstLine.includes(';') ? ';' : ',';
      
      let startRow = 0;
      // Simple heuristic to skip header if it looks like a header
      if (firstLine.toLowerCase().includes('lote') || firstLine.toLowerCase().includes('nombre')) {
          startRow = 1;
      }

      for (let i = startRow; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const parts = lines[i].split(separator);
          if (parts.length >= 1) {
              const name = parts[0].trim();
              let has = 0;
              if (parts[1]) {
                  const hasStr = parts[1].replace(',', '.').trim();
                  has = parseFloat(hasStr) || 0;
              }
              if (name) parsed.push({ name, hectares: has });
          }
      }
      setImportData(parsed);
  };

  const handleConfirmImport = async () => {
      if (!importCompanyId || !importFieldId || importData.length === 0 || !dataOwnerId) return;
      setIsImporting(true);
      try {
          await Storage.batchAddPlots(importData, importFieldId, importCompanyId, dataOwnerId, dataOwnerName);
          alert(`${importData.length} lotes importados exitosamente.`);
          setIsImportModalOpen(false);
          setImportData([]);
          setImportCompanyId('');
          setImportFieldId('');
      } catch (e) {
          console.error(e);
          alert("Error al importar lotes.");
      } finally {
          setIsImporting(false);
      }
  };

  const availableImportFields = fields.filter(f => f.companyId === importCompanyId);
  const availableFormFields = fields.filter(f => !formData.companyId || f.companyId === formData.companyId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Lotes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredItems.length} registros</p>
        </div>
        <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsImportModalOpen(true)}><FileSpreadsheet className="w-4 h-4 mr-2" />Importar</Button>
            <Button onClick={openAdd} disabled={fields.length === 0}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
                <Select label="" placeholder="Todas las Empresas..." options={companies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))} value={filterCompanyId} onChange={(e) => { setFilterCompanyId(e.target.value); setFilterFieldId(''); }} className="text-sm" />
            </div>
            <div className="flex-1">
                <Select label="" placeholder="Todos los Campos..." options={availableFieldsForFilter.sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ value: f.id, label: f.name }))} value={filterFieldId} onChange={(e) => setFilterFieldId(e.target.value)} disabled={!filterCompanyId && companies.length > 0} className="text-sm" />
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

      {/* Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Lote" : "Nuevo Lote"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Empresa" options={companies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))} value={formData.companyId} onChange={e => setFormData({ ...formData, companyId: e.target.value, fieldId: '' })} required placeholder="Seleccionar Empresa" />
          <Select label="Campo" options={availableFormFields.sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ value: f.id, label: f.name }))} value={formData.fieldId} onChange={e => setFormData({ ...formData, fieldId: e.target.value })} required disabled={!formData.companyId} placeholder="Seleccionar Campo" />
          <Input label="Nombre del Lote" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus required />
          <Input label="Hectáreas" type="number" value={formData.hectares} onChange={e => setFormData({ ...formData, hectares: e.target.value })} placeholder="0" />
          
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="order-3 sm:order-1">Cancelar</Button>
            
            {/* Botón Guardar y Otro (Solo en creación) */}
            {!editingItem && (
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
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Importar Lotes (Excel/CSV)">
         <div className="space-y-4">
             <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
                 <div className="flex items-center gap-2 mb-2 font-bold"><AlertCircle className="w-4 h-4"/> Formato Requerido</div>
                 <p>Columnas: <strong>Nombre Lote</strong> (A), <strong>Hectáreas</strong> (B).</p>
                 <p className="mt-1 text-xs opacity-80">La primera fila se considera encabezado.</p>
             </div>
             <div className="grid grid-cols-2 gap-3">
                 <Select label="Empresa Destino" options={companies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))} value={importCompanyId} onChange={(e) => { setImportCompanyId(e.target.value); setImportFieldId(''); }} />
                 <Select label="Campo Destino" options={availableImportFields.sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ value: f.id, label: f.name }))} value={importFieldId} onChange={(e) => setImportFieldId(e.target.value)} disabled={!importCompanyId} />
             </div>
             <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 relative">
                 <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                 <span className="text-sm text-gray-600 dark:text-gray-400">Clic para subir .xlsx, .xls o .csv</span>
                 <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
             </div>
             {importData.length > 0 && (
                 <div className="mt-4 max-h-40 overflow-y-auto border rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-900">
                     <p className="text-xs font-bold mb-2">Previsualización ({importData.length}):</p>
                     {importData.slice(0,10).map((d,i)=>(<div key={i} className="flex justify-between border-b last:border-0 border-gray-200 dark:border-gray-700 py-1"><span>{d.name}</span><span className="font-mono">{d.hectares}</span></div>))}
                     {importData.length > 10 && <div className="text-xs text-gray-500 text-center py-1">...y {importData.length - 10} más</div>}
                 </div>
             )}
             <div className="flex justify-end gap-2 pt-2">
                 <Button variant="ghost" onClick={() => setIsImportModalOpen(false)}>Cancelar</Button>
                 <Button onClick={handleConfirmImport} disabled={isImporting || importData.length === 0 || !importFieldId}>{isImporting ? 'Cargando...' : <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar</>}</Button>
             </div>
         </div>
      </Modal>

      {/* Delete Confirmation Modal (2 Steps) */}
      <Modal isOpen={!!deleteId} onClose={() => { if(!isDeleting) setDeleteId(null); }} title={deleteStep === 1 ? "Eliminar Lote" : "Confirmación de Seguridad"}>
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
