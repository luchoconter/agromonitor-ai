
import React from 'react';
import { Sprout } from 'lucide-react';

interface HeatmapSectionProps {
  matrix: {
    cropName: string;
    counts: Record<string, number>;
  }[];
  columns: string[];
}

export const HeatmapSection: React.FC<HeatmapSectionProps> = ({ matrix, columns }) => {
  if (matrix.length === 0 || columns.length === 0) return null;

  // 1. Calculate Max Value for Scaling Intensity
  let maxCount = 0;
  matrix.forEach(row => {
    columns.forEach(col => {
      if ((row.counts[col] || 0) > maxCount) maxCount = row.counts[col] || 0;
    });
  });

  const getIntensityColor = (value: number) => {
    if (value === 0) return 'transparent';
    const ratio = Math.max(0.1, value / maxCount); // Min opacity 0.1 so it's visible
    return `rgba(239, 68, 68, ${ratio})`; // Red base
  };

  const getTextColor = (value: number) => {
    // If dark background (high intensity), use white text
    return (value / maxCount) > 0.6 ? '#ffffff' : '#374151'; // gray-700
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white leading-none">Matriz de Focos (Heatmap)</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Frecuencia de plagas por cultivo</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left min-w-[120px] text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-900 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] rounded-tl-lg">
                Cultivo
              </th>
              {columns.map(col => (
                <th key={col} className="p-2 text-center min-w-[80px] text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 border-l border-gray-100 dark:border-gray-800">
                  <span className="block truncate max-w-[100px]" title={col}>{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={row.cropName} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <td className="p-3 font-bold text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  {row.cropName}
                </td>
                {columns.map(col => {
                  const count = row.counts[col] || 0;
                  return (
                    <td key={col} className="p-1 text-center relative group">
                      <div
                        className="w-full h-10 rounded-md flex items-center justify-center transition-all hover:scale-105 hover:shadow-sm"
                        style={{ backgroundColor: getIntensityColor(count) }}
                      >
                        {count > 0 && (
                          <span
                            className="text-xs font-bold transition-colors"
                            style={{ color: getTextColor(count) }}
                          >
                            {count}
                          </span>
                        )}
                      </div>

                      {/* Tooltip on Hover */}
                      {count > 0 && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap pointer-events-none">
                          {count} detecciones
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[10px] text-gray-400 text-right italic">
        * Intensidad de color indica frecuencia de detección
      </div>
    </div>
  );
};
