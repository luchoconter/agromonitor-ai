import React, { useState, useRef, useEffect } from 'react';
import { Loader2, X, Eye, EyeOff, ChevronDown, Check, Wifi, WifiOff, Cloud, CheckCircle2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  isLoading,
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm";

  const variants = {
    primary: "bg-agro-600 text-white hover:bg-agro-700 focus:ring-agro-500 dark:bg-agro-500 dark:hover:bg-agro-600",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-agro-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-700 dark:hover:bg-red-600",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', type = 'text', ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const inputType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1 w-full relative">
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
      <div className="relative">
        <input
          type={inputType}
          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-agro-500 focus:border-agro-500 outline-none transition-all bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600 ${error ? 'border-red-500' : 'border-gray-300'} ${className} ${isPasswordType ? 'pr-10' : ''}`}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  error?: string;
  placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({ label, options, error, placeholder, className = '', ...props }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}
    <select
      className={`px-3 py-2 border rounded-lg focus:ring-2 focus:ring-agro-500 focus:border-agro-500 outline-none transition-all bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600 ${error ? 'border-red-500' : 'border-gray-300'} ${className}`}
      {...props}
    >
      <option value="">{placeholder || "Seleccionar..."}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    {error && <span className="text-xs text-red-500">{error}</span>}
  </div>
);

// --- NEW COMPONENT: MultiSelect ---
interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "Seleccionar..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const selectedLabels = options
    .filter(opt => selectedValues.includes(opt.value))
    .map(opt => opt.label);

  const displayValue = selectedLabels.length > 0
    ? (selectedLabels.length <= 2 ? selectedLabels.join(", ") : `${selectedLabels.length} seleccionados`)
    : placeholder;

  return (
    <div className="flex flex-col gap-1 w-full relative" ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>}

      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 flex justify-between items-center cursor-pointer hover:border-agro-500 transition-colors ${isOpen ? 'ring-2 ring-agro-500 border-agro-500' : 'border-gray-300'}`}
      >
        <span className={`text-sm truncate ${selectedValues.length === 0 ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          {displayValue}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center italic">No hay opciones disponibles</div>
          ) : (
            options.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className="flex items-center px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b last:border-0 border-gray-50 dark:border-gray-700/50"
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-agro-600 border-agro-600 text-white' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-200">{opt.label}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, zIndex = 110000 }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-all duration-200" style={{ zIndex }}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col relative">
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- NEW COMPONENT: Toast (Notification) ---
interface ToastProps {
  message: string;
  type: 'success' | 'warning' | 'error';
  isVisible: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Disappear after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const styles = {
    success: 'bg-green-600 text-white shadow-green-900/20',
    warning: 'bg-amber-500 text-white shadow-amber-900/20',
    error: 'bg-red-600 text-white shadow-red-900/20'
  };

  return (
    <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 z-[100] px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transition-all animate-bounce-in ${styles[type]} min-w-[300px]`}>
      <div className="shrink-0">
        {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
        {type === 'warning' && <WifiOff className="w-5 h-5" />}
        {type === 'error' && <WifiOff className="w-5 h-5" />}
      </div>
      <div className="flex-1 text-sm font-medium">
        {message}
      </div>
      <button onClick={onClose} className="text-white/80 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};