
import React, { useState } from 'react';
import { Sprout, Sun, Moon, Clock, WifiOff } from 'lucide-react';
import { Button, Input } from '../components/UI';
import * as Storage from '../services/storageService';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

export const LoginView: React.FC = () => {
    const { login, isDarkMode, toggleTheme } = useAuth();
    const { setView, setSelection } = useUI(); // Used to reset view/selection on login

    const [authMode, setAuthMode] = useState<'credentials' | 'register' | 'pending_approval'>('credentials');
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState('');

    const handleLoginSuccess = (user: any) => {
        login(user);
        setSelection({ companyId: null, fieldId: null, plotId: null, seasonId: null });

        // Default Views based on Role
        if (user.role === 'operator') {
            setView('home');
        } else {
            // Admins and Companies go to Dashboard by default
            setView('analytics');
        }
    };

    const handleCredentialLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError('');

        // Attempt login
        const res = await Storage.loginWithCredentials(loginForm.email, loginForm.password);
        setAuthLoading(false);

        if (res.success && res.user) {
            handleLoginSuccess(res.user);
        } else {
            // Smart Error Handling for Offline Scenarios
            if (!navigator.onLine) {
                setAuthError("Sin conexión. Para validar tus credenciales por primera vez necesitas internet.");
            } else {
                setAuthError(res.error || 'Error de autenticación');
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');

        if (!navigator.onLine) {
            setAuthError("Necesitas conexión a internet para registrar una cuenta nueva.");
            return;
        }

        if (registerForm.password.length < 6) {
            setAuthError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (registerForm.password !== registerForm.confirmPassword) {
            setAuthError('Las contraseñas no coinciden.');
            return;
        }

        setAuthLoading(true);
        const res = await Storage.registerAdmin(registerForm.name, registerForm.email, registerForm.password);
        setAuthLoading(false);

        if (res.success) {
            setAuthMode('pending_approval');
            setRegisterForm({ name: '', email: '', password: '', confirmPassword: '' });
        } else {
            setAuthError(res.error || 'Error al registrar');
        }
    };

    return (
        <div className={`h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 font-sans ${isDarkMode ? 'dark' : ''}`}>
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-agro-600 dark:bg-agro-700 p-6 md:p-8 text-center relative">
                    <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4">
                        <Sprout className="w-8 h-8 text-agro-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Ing Arg. Msc. Enrique A Marcon (v.1.1)</h1>
                    <p className="text-agro-100 mt-2 text-sm">Sistema de Consultoría Agronómica</p>
                    <div className="absolute top-4 right-4">
                        <button onClick={toggleTheme} className="p-2 rounded-full text-white/80 hover:bg-white/10 transition-colors">
                            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
                <div className="p-6 md:p-8">

                    {authMode === 'credentials' && (
                        <form onSubmit={handleCredentialLogin} className="space-y-4">
                            <div className="text-center mb-4"><h3 className="font-bold text-gray-800 dark:text-white">Ingreso Seguro</h3></div>
                            <Input label="Usuario o Email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} autoFocus />
                            <Input label="Contraseña" type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
                            {authError && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm text-center border border-red-100 dark:border-red-800 flex items-center justify-center">
                                    {authError.includes("conexión") && <WifiOff className="w-4 h-4 mr-2" />}
                                    {authError}
                                </div>
                            )}
                            <Button className="w-full" isLoading={authLoading}>Iniciar Sesión</Button>
                            <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200 dark:border-gray-700"></span></div><div className="relative flex justify-center text-xs"><span className="px-2 bg-white dark:bg-gray-800 text-gray-500">¿Eres Ingeniero?</span></div></div>
                            <Button type="button" variant="secondary" onClick={() => setAuthMode('register')} className="w-full mb-2">Crear mi Consultora</Button>
                        </form>
                    )}
                    {authMode === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="text-center mb-4"><h3 className="font-bold text-gray-800 dark:text-white">Nueva Consultora</h3><p className="text-xs text-gray-500">Solo para Ingenieros/Administradores</p></div>
                            <Input label="Nombre Completo" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} autoFocus required />
                            <Input label="Email Profesional" type="email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} required />
                            <Input label="Crear Contraseña" type="password" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} required />
                            <Input label="Repetir Contraseña" type="password" value={registerForm.confirmPassword} onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} required />
                            {authError && <div className="text-red-500 text-sm text-center">{authError}</div>}
                            <Button className="w-full" isLoading={authLoading}>Crear Cuenta</Button>
                            <Button type="button" variant="ghost" onClick={() => setAuthMode('credentials')} className="w-full">Volver</Button>
                        </form>
                    )}
                    {authMode === 'pending_approval' && (
                        <div className="text-center space-y-6">
                            <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center"><Clock className="w-8 h-8" /></div>
                            <div><h3 className="text-xl font-bold text-gray-800 dark:text-white">Cuenta en Revisión</h3><p className="text-gray-500 dark:text-gray-400 mt-2 text-sm leading-relaxed max-w-xs mx-auto">Gracias por registrarte. Tu cuenta está siendo validada por nuestro equipo administrativo.<br /><br />Te notificaremos cuando tu acceso sea habilitado.</p></div>
                            <Button className="w-full" onClick={() => setAuthMode('credentials')}>Volver al Inicio</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
