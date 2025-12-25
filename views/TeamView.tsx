import React, { useState, useEffect } from 'react';
import { Users, Plus, Tractor, Building2, Trash2, Loader2, Edit2, AlertTriangle } from 'lucide-react';
import { Button, Modal, Select, Input } from '../components/UI';
import * as Storage from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { User } from '../types';

export const TeamView: React.FC = () => {
  const { currentUser } = useAuth();
  const { data, userCompanies } = useData(); 
  
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: '', username: '', password: '', confirmPassword: '', role: 'operator', linkedCompanyId: '' });
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Delete Modal
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
        const fetchTeam = async () => {
            setIsLoadingTeam(true);
            try {
                const members = await Storage.getTeamMembers(currentUser.id);
                setTeamMembers(members);
            } catch (e) {
                console.error("Error fetching team", e);
            } finally {
                setIsLoadingTeam(false);
            }
        };
        fetchTeam();
    }
  }, [currentUser]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    // Validations
    if (teamForm.password || teamForm.confirmPassword) {
        if (teamForm.password.length < 6) { alert('La contraseña debe tener al menos 6 caracteres.'); return; }
        if (teamForm.password !== teamForm.confirmPassword) { alert('Las contraseñas no coinciden.'); return; }
    }
    
    // Create mode: password is required
    if (!editingMemberId && !teamForm.password) {
        alert('La contraseña es obligatoria para usuarios nuevos.');
        return;
    }

    // Company required if role is company
    if (teamForm.role === 'company' && !teamForm.linkedCompanyId) {
        alert('Debe asignar una empresa al cliente.');
        return;
    }

    let success = false;

    if (editingMemberId) {
        // Update mode
        success = await Storage.updateSubUser(
            editingMemberId, 
            teamForm.name, 
            teamForm.username, 
            teamForm.role as any, 
            teamForm.password,
            teamForm.linkedCompanyId
        );
    } else {
        // Create mode
        success = await Storage.createSubUser(
            currentUser.id, 
            currentUser.name, 
            teamForm.role as any, 
            teamForm.name, 
            teamForm.username, 
            teamForm.password, 
            teamForm.linkedCompanyId
        );
    }

    if (success) {
        alert(editingMemberId ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente');
        setIsTeamModalOpen(false);
        resetForm();
        // Refetch
        const members = await Storage.getTeamMembers(currentUser.id);
        setTeamMembers(members);
    } else {
        alert('Error al guardar usuario');
    }
  };

  const handleEditUser = (member: User) => {
      setEditingMemberId(member.id);
      
      setTeamForm({
          name: member.name,
          username: member.email,
          role: member.role,
          password: '',
          confirmPassword: '',
          linkedCompanyId: member.linkedCompanyId || ''
      });
      setIsTeamModalOpen(true);
  };

  const handleDeleteUserClick = (userId: string) => {
      setDeleteUserId(userId);
  };

  const confirmDeleteUser = async () => {
    if (!currentUser || !deleteUserId) return;
    
    setIsLoadingTeam(true); 
    try {
        await Storage.deleteSubUser(deleteUserId);
        const members = await Storage.getTeamMembers(currentUser.id);
        setTeamMembers(members);
    } catch (error) {
        console.error("Error deleting user:", error);
        alert("Error al eliminar el usuario.");
    } finally {
        setIsLoadingTeam(false);
        setDeleteUserId(null);
    }
  };

  const resetForm = () => {
      setTeamForm({ name: '', username: '', password: '', confirmPassword: '', role: 'operator', linkedCompanyId: '' });
      setEditingMemberId(null);
  };

  const openCreateModal = () => {
      resetForm();
      setIsTeamModalOpen(true);
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div><h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Gestión de Equipo</h2><p className="text-gray-500 text-sm">Cree y administre usuarios para Operarios y Clientes.</p></div>
            <Button onClick={openCreateModal} className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2" /> Nuevo Usuario</Button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-8">
            <div className="p-8 text-center border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500 mb-4"><Users className="w-8 h-8" /></div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Directorio de Usuarios</h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-lg mx-auto text-sm">Estos son los usuarios que dependen de su cuenta de Administrador. <br/>Ellos ingresan con el <strong>Usuario/Alias</strong> y la <strong>Contraseña</strong> que usted definió.</p>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {isLoadingTeam ? (<div className="p-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Cargando equipo...</div>) : teamMembers.length === 0 ? (<div className="p-8 text-center text-gray-400 italic">No tiene usuarios creados aún.</div>) : (
                    teamMembers.map(member => {
                        const linkedCompanyName = member.linkedCompanyId 
                            ? userCompanies.find(c => c.id === member.linkedCompanyId)?.name 
                            : null;

                        return (
                            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <div className="flex items-center space-x-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${member.role === 'operator' ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'}`}>{member.role === 'operator' ? <Tractor className="w-5 h-5"/> : <Building2 className="w-5 h-5"/>}</div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">{member.name}</p>
                                        <p className="text-xs text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded inline-block mt-1 mr-2">Login: {member.email}</p>
                                        {linkedCompanyName && <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800">{linkedCompanyName}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="text-right hidden sm:block mr-2"><span className={`text-xs px-2 py-1 rounded-full border ${member.role === 'operator' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'}`}>{member.role === 'operator' ? 'Operario' : 'Cliente'}</span></div>
                                    <button onClick={() => handleEditUser(member)} className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all" title="Editar usuario"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteUserClick(member.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all" title="Eliminar usuario"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
        <Modal isOpen={isTeamModalOpen} onClose={() => setIsTeamModalOpen(false)} title={editingMemberId ? "Editar Usuario" : "Crear Nuevo Usuario"}>
            <form onSubmit={handleSaveUser} className="space-y-4">
                <Select label="Tipo de Usuario" options={[{ value: 'operator', label: 'Operario (Carga datos en todos mis campos)' }, { value: 'company', label: 'Cliente (Solo ve su empresa)' }]} value={teamForm.role} onChange={e => setTeamForm({...teamForm, role: e.target.value, linkedCompanyId: ''})} />
                
                {teamForm.role === 'company' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Asignar Empresa Existente</h4>
                        {userCompanies.length === 0 ? (
                            <div className="text-red-500 text-xs flex items-center"><AlertTriangle className="w-4 h-4 mr-1"/> No tienes empresas creadas. Ve a "Empresas" primero.</div>
                        ) : (
                            <Select 
                                label="Seleccione la empresa que verá este cliente" 
                                options={userCompanies.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name }))}
                                value={teamForm.linkedCompanyId}
                                onChange={e => setTeamForm({...teamForm, linkedCompanyId: e.target.value})}
                                required
                            />
                        )}
                    </div>
                )}

                <Input label="Nombre y Apellido" value={teamForm.name} onChange={e => setTeamForm({...teamForm, name: e.target.value})} required />
                <Input label="Usuario / Alias (Login)" value={teamForm.username} onChange={e => setTeamForm({...teamForm, username: e.target.value})} placeholder={teamForm.role === 'operator' ? "Ej: pepe" : "Ej: campo_la_estancia"} required />
                
                <div className="grid grid-cols-2 gap-2">
                    <Input label="Contraseña / PIN" type="password" value={teamForm.password} onChange={e => setTeamForm({...teamForm, password: e.target.value})} required={!editingMemberId} placeholder={editingMemberId ? "Dejar en blanco si no cambia" : ""} />
                    <Input label="Confirmar" type="password" value={teamForm.confirmPassword} onChange={e => setTeamForm({...teamForm, confirmPassword: e.target.value})} required={!editingMemberId} placeholder={editingMemberId ? "Dejar en blanco si no cambia" : ""} />
                </div>
                
                <div className="flex justify-end gap-2 pt-4"><Button type="button" variant="ghost" onClick={() => setIsTeamModalOpen(false)}>Cancelar</Button><Button type="submit">{editingMemberId ? "Guardar Cambios" : "Crear Usuario"}</Button></div>
            </form>
        </Modal>

        {/* Delete User Modal */}
        <Modal isOpen={!!deleteUserId} onClose={() => setDeleteUserId(null)} title="Eliminar Usuario">
            <div className="space-y-4">
                <p className="text-gray-700 dark:text-gray-300">
                    ¿Está seguro de eliminar este usuario? Solo se borrará el acceso, la empresa vinculada (si existe) permanecerá intacta.
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setDeleteUserId(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={confirmDeleteUser}>Eliminar</Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};