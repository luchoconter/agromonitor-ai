import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Star } from 'lucide-react';
import { Button, Input, Modal } from '../UI';
import { Season } from '../../types';
import * as Storage from '../../services/storageService';
import { useData } from '../../contexts/DataContext';

interface SeasonManagerProps {
  seasons: Season[];
}

export const SeasonManager: React.FC<SeasonManagerProps> = ({ seasons }) => {
  const { dataOwnerId, dataOwnerName } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Season | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = seasons
    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const openEdit = (item: Season) => {
    setEditingItem(item);
    setFormData({ name: item.name });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setDeleteId(id);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await Storage.deleteSeason(deleteId);
          setDeleteId(null);
      }
  };

  const handleActivate = async (id: string) => {
      if (dataOwnerId) {
          await Storage.setActiveSeason(id, dataOwnerId);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !dataOwnerId) return;

    if (editingItem) {
      await Storage.updateSeason(editingItem.id, formData.name);
    } else {
      await Storage.addSeason(formData.name, dataOwnerId, dataOwnerName);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Campañas</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredItems.length} registros</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
      </div>

      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input type="text" placeholder="Buscar campaña..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none transition-all text-sm dark:text-gray-200" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">No se encontraron campañas.</div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
              <span className={`font-semibold ${item.isActive ? 'text-agro-600 dark:text-agro-400' : 'text-gray-800 dark:text-gray-200'}`}>{item.name} {item.isActive && '(Activa)'}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleActivate(item.id)} className={`p-2 rounded-full transition-colors ${item.isActive ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`} title="Activar Campaña"><Star className={`w-5 h-5 ${item.isActive ? 'fill-current' : ''}`} /></button>
                <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Campaña" : "Nueva Campaña"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la Campaña" value={formData.name} onChange={e => setFormData({ name: e.target.value })} autoFocus required />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Campaña">
          <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                  ¿Estás seguro de eliminar esta campaña?
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