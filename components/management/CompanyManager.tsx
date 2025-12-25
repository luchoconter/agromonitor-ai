
import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, X, Loader2, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Button, Input, Modal } from '../UI';
import { Company } from '../../types';
import * as Storage from '../../services/storageService';
import * as DeepDelete from '../../services/deepDeleteService'; // Importar nuevo servicio
import { useAuth } from '../../contexts/AuthContext';

interface CompanyManagerProps {
  companies: Company[];
}

export const CompanyManager: React.FC<CompanyManagerProps> = ({ companies }) => {
  const { currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Company | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1); // Step 1: Warning, Step 2: Password

  const filteredItems = companies
    .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ name: '' });
    setIsModalOpen(true);
  };

  const openEdit = (item: Company) => {
    setEditingItem(item);
    setFormData({ name: item.name });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string) => {
      setConfirmPassword('');
      setPasswordError('');
      setDeleteStep(1); // Reset to step 1
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
        // Usar Deep Delete
        await DeepDelete.deepDeleteCompany(deleteId);
        setDeleteId(null);
    } catch (error) {
        console.error("Error deleting company:", error);
        alert("Ocurrió un error al eliminar la empresa.");
    } finally {
        setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingItem) {
      await Storage.updateCompany(editingItem.id, formData.name);
    } else if (currentUser) {
      await Storage.addCompany(formData.name, currentUser.id, currentUser.name);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Empresas</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredItems.length} registros</p>
        </div>
        <Button onClick={openAdd}><Plus className="w-4 h-4 mr-2" />Nueva</Button>
      </div>

      {/* Search */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Buscar empresa..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-agro-500 outline-none transition-all text-sm dark:text-gray-200"
            />
            {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            No se encontraron empresas.
          </div>
        ) : (
          filteredItems.map(item => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg hover:shadow-md transition-all">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{item.name}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(item)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteClick(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Editar Empresa" : "Nueva Empresa"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Nombre de la Empresa" value={formData.name} onChange={e => setFormData({ name: e.target.value })} autoFocus required />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal (2 Steps) */}
      <Modal isOpen={!!deleteId} onClose={() => { if(!isDeleting) setDeleteId(null); }} title={deleteStep === 1 ? "Eliminar Empresa" : "Confirmación de Seguridad"}>
          <div className="space-y-4">
              {deleteStep === 1 && (
                  <>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-800">
                          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-2">
                              <p className="font-bold text-red-800 dark:text-red-300 text-sm">¡Atención! Acción Destructiva</p>
                              <p className="text-red-700 dark:text-red-400 text-sm leading-relaxed">
                                  Estás a punto de eliminar una <strong>Empresa</strong> completa. Esto borrará permanentemente:
                              </p>
                              <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 pl-1 space-y-1">
                                  <li>Todos los Campos asociados.</li>
                                  <li>Todos los Lotes y su historial.</li>
                                  <li>Miles de fotos, audios y monitoreos.</li>
                                  <li>Recetas agronómicas y cierres.</li>
                              </ul>
                          </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">¿Realmente deseas continuar?</p>
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
                                      Por seguridad, ingrese su contraseña de administrador para confirmar el borrado masivo.
                                  </p>
                              </div>
                              
                              <Input 
                                  label="Contraseña del Administrador"
                                  type="password"
                                  placeholder="Su contraseña actual"
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
                                      Eliminar Definitivamente
                                  </Button>
                              </div>
                          </>
                      ) : (
                          <div className="flex flex-col items-center justify-center p-8 space-y-4">
                              <Loader2 className="w-10 h-10 text-agro-600 dark:text-agro-400 animate-spin" />
                              <div className="text-center">
                                  <p className="font-bold text-gray-800 dark:text-gray-200">Limpiando Base de Datos</p>
                                  <p className="text-xs text-gray-500 mt-1">Eliminando archivos y registros en cascada...</p>
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
