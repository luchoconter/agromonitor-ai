import React from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';

interface InstallInstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    isIOS: boolean;
}

export const InstallInstructionsModal: React.FC<InstallInstructionsModalProps> = ({ isOpen, onClose, isIOS }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-gray-200 dark:border-gray-700 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="p-6">
                    <div className="bg-agro-100 dark:bg-agro-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Download className="w-8 h-8 text-agro-600 dark:text-agro-400" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                        Instalar Aplicación
                    </h3>

                    <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
                        Instala la App en tu dispositivo para acceder más rápido y usarla sin conexión.
                    </p>

                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6 border border-gray-100 dark:border-gray-600">
                        {isIOS ? (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-white dark:bg-gray-600 p-1.5 rounded shadow-sm shrink-0">
                                        <Share className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">1. Toca "Compartir"</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">En la barra de navegación inferior.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="bg-white dark:bg-gray-600 p-1.5 rounded shadow-sm shrink-0">
                                        <PlusSquare className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">2. "Agregar a Inicio"</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Desliza hacia abajo hasta encontrar la opción.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-white dark:bg-gray-600 p-1.5 rounded shadow-sm shrink-0">
                                        <div className="text-gray-800 dark:text-gray-200 font-bold text-lg leading-none">⋮</div>
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">1. Abre el menú</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Toca los tres puntos en la esquina superior derecha.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="bg-white dark:bg-gray-600 p-1.5 rounded shadow-sm shrink-0">
                                        <Download className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">2. "Instalar aplicación"</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Selecciona la opción en el menú.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 px-4 bg-agro-600 hover:bg-agro-700 text-white rounded-lg font-semibold transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};
