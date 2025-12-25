
import React from 'react';
import { ClipboardCheck, Map, AlertOctagon, Sprout } from 'lucide-react';

interface KPISectionProps {
  total: number;
  critical: number;
  topPest: string;
  surveyedHectares: number;
}

export const KPISection: React.FC<KPISectionProps> = ({ total, critical, topPest, surveyedHectares }) => {
  // Helper component to separate mobile/desktop designs strictly
  const KPICard = ({ 
    label, 
    value, 
    subValue,
    icon: Icon, 
    desktopBg, 
    desktopColor,
    mobileBg,
    mobileColor 
  }: any) => (
    <div className="bg-white dark:bg-gray-800 p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative group h-full transition-all">
      
      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex flex-row items-center">
        <div className={`w-12 h-12 rounded-full ${desktopBg} ${desktopColor} flex items-center justify-center mr-4 shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">{label}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white flex items-baseline gap-1">
            {value}
            {subValue && <span className="text-sm font-normal text-gray-500">{subValue}</span>}
          </p>
        </div>
      </div>

      {/* MOBILE LAYOUT (Minimalist & Compact - 2x2 Grid optimized) */}
      <div className="flex md:hidden flex-col justify-between h-full min-h-[70px]">
         <div className="flex justify-between items-start mb-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none">{label}</p>
            <Icon className={`w-4 h-4 ${mobileColor} opacity-80`} />
         </div>
         <p className="text-xl font-bold text-gray-800 dark:text-white truncate leading-tight flex items-baseline gap-0.5 mt-auto">
             {value}
             {subValue && <span className="text-[9px] font-normal text-gray-400 ml-0.5">{subValue}</span>}
         </p>
      </div>

    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
      <KPICard 
        label="Lotes"
        value={total}
        icon={ClipboardCheck}
        desktopBg="bg-blue-100 dark:bg-blue-900/30"
        desktopColor="text-blue-600"
        mobileBg="bg-blue-50 dark:bg-blue-900/20"
        mobileColor="text-blue-500"
      />

      <KPICard 
        label="Relevado"
        value={Math.round(surveyedHectares)}
        subValue="Has"
        icon={Map}
        desktopBg="bg-green-100 dark:bg-green-900/30"
        desktopColor="text-green-600"
        mobileBg="bg-green-50 dark:bg-green-900/20"
        mobileColor="text-green-500"
      />

      <KPICard 
        label="Alertas"
        value={critical}
        icon={AlertOctagon}
        desktopBg={critical > 0 ? 'bg-red-100 animate-pulse' : 'bg-gray-100'}
        desktopColor={critical > 0 ? 'text-red-600' : 'text-gray-500'}
        mobileBg={critical > 0 ? 'bg-red-50 dark:bg-red-900/20 animate-pulse' : 'bg-gray-50 dark:bg-gray-800'}
        mobileColor={critical > 0 ? 'text-red-500' : 'text-gray-400'}
      />

      <KPICard 
        label="Dominante"
        value={topPest}
        icon={Sprout}
        desktopBg="bg-amber-100 dark:bg-amber-900/30"
        desktopColor="text-amber-600"
        mobileBg="bg-amber-50 dark:bg-amber-900/20"
        mobileColor="text-amber-500"
      />
    </div>
  );
};
