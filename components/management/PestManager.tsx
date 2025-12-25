
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Image as ImageIcon, Upload } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { Pest } from '../../types';
import * as Storage from '../../services/storageService';
import { useData } from '../../contexts/DataContext';

interface PestManagerProps {
  pests: Pest[];
}

export const PestManager: React.FC<PestManagerProps> = ({ pests }) => {
  const { dataOwnerId, dataOwnerName } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Pest | null>(null);
  const [formData, setFormData] = useState({ name: '', defaultUnit: '', imageUrl: '' });
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Loading state for upload
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New state for image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = pests
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const UNIT_OPTIONS = [
      { value: 'Unidades/metro', label: 'Unidades/metro' },
      { value: 'Cantidad cada 100 plantas', label: 'Cantidad cada 100 plantas' },
      { value: 'Unidades/planta', label: 'Unidades/planta' },
      { value: 'Concentracion', label: 'Concentracion' },
      { value: '__custom__', label: 'Otra (Especificar...)' }
  ];

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', defaultUnit: '', imageUrl: '' });
    setIsCustomUnit(false);
    setIsModalOpen(true);
  };

  const openEdit = (item: Pest) => {
    setEditingItem(item);
    const isStandard = UNIT_OPTIONS.some(o => o.value === item.defaultUnit);
    setIsCustomUnit(!!item.defaultUnit && !isStandard);
    setFormData({ name: item.name, defaultUnit: item.defaultUnit || '', imageUrl: item.imageUrl || '' });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteId(id);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await Storage.deletePest(deleteId);
          setDeleteId(null);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setFormData({ ...formData, imageUrl: URL.createObjectURL(file) });
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !dataOwnerId) return;

    setIsSubmitting(true);
    try {
        if (editingItem) {
          await Storage.updatePest(editingItem.id, formData.name, { defaultUnit: formData.defaultUnit, imageUrl: formData.imageUrl });
        } else {
          await Storage.addPest(formData.name, dataOwnerId, dataOwnerName, { defaultUnit: formData.defaultUnit, imageUrl: formData.imageUrl });
        }
        setIsModalOpen(false);
    } catch (error) {
        console.error(error);
        alert("Error al guardar la plaga");
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <div><h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Plagas</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredItems.length} registros</p></div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
      </div>
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Buscar plaga..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none text-sm dark:text-gray-200" /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                    <div 
                        className={`w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0 border border-gray-200 dark:border-gray-600 flex items-center justify-center ${item.imageUrl ? 'cursor-zoom-in hover:opacity-90' : ''}`}
                        onClick={() => item.imageUrl && setPreviewImage(item.imageUrl)}
                    >
                        {item.imageUrl ? <img src={item.imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-gray-400"/>}
                    </div>
                    <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 block">{item.name}</span>
                        <span className="text-xs text-gray-500">{item.defaultUnit || 'Sin unidad'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 rounded-full"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full"><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
        ))}
      </div>
      
      {/* Edit/Create Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Plaga" : "Nueva Plaga"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la Plaga" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus required />
          <Select label="Unidad de Medida" options={UNIT_OPTIONS} value={isCustomUnit ? '__custom__' : formData.defaultUnit} onChange={(e) => { if (e.target.value === '__custom__') { setIsCustomUnit(true); setFormData({...formData, defaultUnit: ''}); } else { setIsCustomUnit(false); setFormData({...formData, defaultUnit: e.target.value}); } }} />
          {isCustomUnit && <Input label="Especifique unidad" value={formData.defaultUnit} onChange={(e) => setFormData({...formData, defaultUnit: e.target.value})} required />}
          <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Imagen de Referencia</label>
              <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 border dark:border-gray-600 flex items-center justify-center overflow-hidden">
                      {formData.imageUrl ? <img src={formData.imageUrl} className="w-full h-full object-cover"/> : <ImageIcon className="w-6 h-6 text-gray-400"/>}
                  </div>
                  <label className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors">
                      <Upload className="w-4 h-4 mr-2 inline"/>
                      Subir
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange}/>
                  </label>
              </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" isLoading={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={!!previewImage} onClose={() => setPreviewImage(null)} title="Referencia Visual">
          <div className="flex justify-center items-center bg-gray-100 dark:bg-gray-900/50 rounded-xl p-2 min-h-[200px]">
             {previewImage && <img src={previewImage} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm" alt="Referencia" />}
          </div>
          <div className="flex justify-end pt-4">
              <Button onClick={() => setPreviewImage(null)}>Cerrar</Button>
          </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Plaga">
          <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                  ¿Estás seguro de eliminar esta plaga?
              </p>
              <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
                  <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
