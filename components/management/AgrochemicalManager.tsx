
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, DollarSign } from 'lucide-react';
import { Button, Input, Modal, Select } from '../UI';
import { Agrochemical } from '../../types';
import * as Storage from '../../services/storageService';
import { useData } from '../../contexts/DataContext';

interface AgrochemicalManagerProps {
  agrochemicals: Agrochemical[];
}

export const AgrochemicalManager: React.FC<AgrochemicalManagerProps> = ({ agrochemicals }) => {
  const { dataOwnerId, dataOwnerName } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Agrochemical | null>(null);
  
  // FORM STATE: Include price and priceUnit
  const [formData, setFormData] = useState<{
      name: string; 
      type: string; 
      activeIngredient: string; 
      price: string;
      priceUnit: 'Lt' | 'Kg';
  }>({ name: '', type: '', activeIngredient: '', price: '', priceUnit: 'Lt' });
  
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = agrochemicals
    .filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const TYPES = [
    { value: 'Herbicida', label: 'Herbicida' },
    { value: 'Insecticida', label: 'Insecticida' },
    { value: 'Fungicida', label: 'Fungicida' },
    { value: 'Fertilizante', label: 'Fertilizante' },
    { value: 'Coadyuvante', label: 'Coadyuvante' },
    { value: 'Semilla', label: 'Semilla' },
    { value: 'Otro', label: 'Otro' }
  ];

  const PRICE_UNITS = [
      { value: 'Lt', label: 'Litro (Lt)' },
      { value: 'Kg', label: 'Kilo (Kg)' }
  ];

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ name: '', type: 'Herbicida', activeIngredient: '', price: '', priceUnit: 'Lt' });
    setIsModalOpen(true);
  };

  const openEdit = (item: Agrochemical) => {
    setEditingItem(item);
    setFormData({ 
        name: item.name, 
        type: item.type, 
        activeIngredient: item.activeIngredient || '',
        price: item.price ? item.price.toString() : '',
        priceUnit: item.priceUnit || 'Lt' // Default to Lt if legacy data
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteId(id);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await Storage.deleteAgrochemical(deleteId);
          setDeleteId(null);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !dataOwnerId) return;

    const extra = { 
        type: formData.type, 
        activeIngredient: formData.activeIngredient,
        price: formData.price ? parseFloat(formData.price) : undefined,
        priceUnit: formData.priceUnit
    };

    if (editingItem) {
      await Storage.updateAgrochemical(editingItem.id, formData.name, extra);
    } else {
      await Storage.addAgrochemical(formData.name, dataOwnerId, dataOwnerName, extra);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <div><h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Insumos</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredItems.length} registros</p></div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Nuevo</Button>
      </div>
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder="Buscar insumo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none text-sm dark:text-gray-200" /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
                <div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 block">{item.name}</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">{item.type}</span>
                        {item.activeIngredient && <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">PA: {item.activeIngredient}</span>}
                        {item.price && (
                            <span className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-100 dark:border-green-800/50 flex items-center">
                                <DollarSign className="w-3 h-3 mr-0.5" />
                                {item.price} / {item.priceUnit || '?'}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 rounded-full"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full"><Trash2 className="w-4 h-4" /></button>
                </div>
            </div>
        ))}
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Insumo" : "Nuevo Insumo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre Comercial" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus required />
          
          <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" options={TYPES} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} />
              <Input label="Principio Activo" value={formData.activeIngredient} onChange={e => setFormData({ ...formData, activeIngredient: e.target.value })} placeholder="Opcional" />
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30">
              <label className="block text-sm font-medium text-green-800 dark:text-green-300 mb-2">Costo Estimado</label>
              <div className="flex gap-3">
                  <div className="flex-1">
                      <Input 
                        label="Precio (USD)" 
                        type="number" 
                        placeholder="0.00" 
                        value={formData.price} 
                        onChange={e => setFormData({ ...formData, price: e.target.value })} 
                        className="bg-white dark:bg-gray-900"
                      />
                  </div>
                  <div className="w-1/3">
                      <Select 
                        label="Por Unidad" 
                        options={PRICE_UNITS} 
                        value={formData.priceUnit} 
                        onChange={e => setFormData({ ...formData, priceUnit: e.target.value as 'Lt' | 'Kg' })} 
                        className="bg-white dark:bg-gray-900"
                      />
                  </div>
              </div>
              <p className="text-[10px] text-green-600 dark:text-green-400 mt-2 italic">
                  * El precio debe ser por la unidad base (1 Litro o 1 Kilo), no por envase.
              </p>
          </div>

          <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Insumo">
          <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                  ¿Estás seguro de eliminar este insumo?
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