import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { Button, Input, Modal } from '../UI';
import { Crop, Task } from '../../types';
import * as Storage from '../../services/storageService';
import { useData } from '../../contexts/DataContext';

// --- CROP MANAGER ---
export const CropManager: React.FC<{ crops: Crop[] }> = ({ crops }) => {
  const { dataOwnerId, dataOwnerName } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Crop | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = crops
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => { setEditingItem(null); setFormData({ name: '' }); setIsModalOpen(true); };
  const openEdit = (item: Crop) => { setEditingItem(item); setFormData({ name: item.name }); setIsModalOpen(true); };
  
  const handleDeleteClick = (id: string) => setDeleteId(id);
  const confirmDelete = async () => { if (deleteId) { await Storage.deleteCrop(deleteId); setDeleteId(null); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !dataOwnerId) return;
    if (editingItem) await Storage.updateCrop(editingItem.id, formData.name);
    else await Storage.addCrop(formData.name, dataOwnerId, dataOwnerName);
    setIsModalOpen(false);
  };

  return (
    <SimpleListLayout title="Cultivos" count={filteredItems.length} onAdd={openAdd} searchTerm={searchTerm} onSearch={setSearchTerm}>
      {filteredItems.map(item => (
        <SimpleListItem key={item.id} name={item.name} onEdit={() => openEdit(item)} onDelete={() => handleDeleteClick(item.id)} />
      ))}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Cultivo" : "Nuevo Cultivo"}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre" value={formData.name} onChange={e => setFormData({ name: e.target.value })} autoFocus required />
            <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </form>
      </Modal>
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Cultivo">
          <div className="space-y-4"><p className="text-gray-700 dark:text-gray-300">¿Eliminar este cultivo?</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button><Button variant="danger" onClick={confirmDelete}>Eliminar</Button></div></div>
      </Modal>
    </SimpleListLayout>
  );
};

// --- TASK MANAGER ---
export const TaskManager: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const { dataOwnerId, dataOwnerName } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Task | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredItems = tasks
    .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => { setEditingItem(null); setFormData({ name: '' }); setIsModalOpen(true); };
  const openEdit = (item: Task) => { setEditingItem(item); setFormData({ name: item.name }); setIsModalOpen(true); };
  
  const handleDeleteClick = (id: string) => setDeleteId(id);
  const confirmDelete = async () => { if (deleteId) { await Storage.deleteTask(deleteId); setDeleteId(null); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !dataOwnerId) return;
    if (editingItem) await Storage.updateTask(editingItem.id, formData.name);
    else await Storage.addTask(formData.name, dataOwnerId, dataOwnerName);
    setIsModalOpen(false);
  };

  return (
    <SimpleListLayout title="Tareas" count={filteredItems.length} onAdd={openAdd} searchTerm={searchTerm} onSearch={setSearchTerm}>
      {filteredItems.map(item => (
        <SimpleListItem key={item.id} name={item.name} onEdit={() => openEdit(item)} onDelete={() => handleDeleteClick(item.id)} />
      ))}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Tarea" : "Nueva Tarea"}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Nombre" value={formData.name} onChange={e => setFormData({ name: e.target.value })} autoFocus required />
            <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </form>
      </Modal>
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar Tarea">
          <div className="space-y-4"><p className="text-gray-700 dark:text-gray-300">¿Eliminar esta tarea?</p><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button><Button variant="danger" onClick={confirmDelete}>Eliminar</Button></div></div>
      </Modal>
    </SimpleListLayout>
  );
};

// --- SHARED UI COMPONENTS ---
const SimpleListLayout: React.FC<{ title: string; count: number; onAdd: () => void; searchTerm: string; onSearch: (s: string) => void; children: React.ReactNode }> = ({ title, count, onAdd, searchTerm, onSearch, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
      <div><h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{count} registros</p></div>
      <Button onClick={onAdd}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
    </div>
    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
      <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" /><input type="text" placeholder={`Buscar ${title.toLowerCase()}...`} value={searchTerm} onChange={(e) => onSearch(e.target.value)} className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none text-sm dark:text-gray-200" /> {searchTerm && <button onClick={() => onSearch('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}</div>
    </div>
    <div className="flex-1 overflow-y-auto p-6 space-y-3">{children}</div>
  </div>
);

const SimpleListItem: React.FC<{ name: string; onEdit: () => void; onDelete: () => void }> = ({ name, onEdit, onDelete }) => (
  <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
    <span className="font-semibold text-gray-800 dark:text-gray-200">{name}</span>
    <div className="flex items-center gap-2">
      <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"><Edit2 className="w-4 h-4" /></button>
      <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"><Trash2 className="w-4 h-4" /></button>
    </div>
  </div>
);