
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, UserRole } from '../../types/auth';

const SESSION_KEY = 'agromonitor_session';

export const getCurrentSession = (): User | null => {
  if (typeof window === 'undefined') return null;
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

export const logout = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
};

export const loginWithCredentials = async (email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
             return { success: false, error: 'Usuario no encontrado' };
        }
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as User;
        
        if (userData.password && userData.password !== password) {
             return { success: false, error: 'Contraseña incorrecta' };
        }
        
        if (userData.status && userData.status !== 'active') {
            return { success: false, error: 'Cuenta pendiente o suspendida.' };
        }
        
        const userWithId = { ...userData, id: userDoc.id };
        localStorage.setItem(SESSION_KEY, JSON.stringify(userWithId));
        return { success: true, user: userWithId };
    } catch (e) {
        console.error(e);
        return { success: false, error: 'Error de conexión' };
    }
};

export const registerAdmin = async (name: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const existing = await getDocs(q);
        if (!existing.empty) return { success: false, error: 'El email ya está registrado' };

        const newUser: Omit<User, 'id'> = {
            name,
            email,
            password,
            role: 'admin',
            status: 'pending',
            consultancyName: name
        };
        await addDoc(collection(db, 'users'), newUser);
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Error al registrar' };
    }
};

export const getTeamMembers = async (adminId: string): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('linkedAdminId', '==', adminId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
};

export const createSubUser = async (adminId: string, adminName: string, role: UserRole, name: string, email: string, password: string, linkedCompanyId?: string): Promise<boolean> => {
    try {
        await addDoc(collection(db, 'users'), { name, email, password, role, linkedAdminId: adminId, consultancyName: adminName, status: 'active', linkedCompanyId: role === 'company' ? linkedCompanyId : null });
        return true;
    } catch (e) { return false; }
};

export const updateSubUser = async (userId: string, name: string, email: string, role: UserRole, password?: string, linkedCompanyId?: string): Promise<boolean> => {
    try {
        const data: any = { name, email, role };
        if (password) data.password = password;
        if (role === 'company') data.linkedCompanyId = linkedCompanyId;
        await updateDoc(doc(db, 'users', userId), data);
        return true;
    } catch (e) { return false; }
};

export const deleteSubUser = async (userId: string) => { await deleteDoc(doc(db, 'users', userId)); };
