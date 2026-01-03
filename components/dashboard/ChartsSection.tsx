
import React, { forwardRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

const PEST_COLORS = [
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
  '#6366f1', // Indigo
];

interface ChartsSectionProps {
  healthHistory: any[];
  pestHistory: any[];
  topPests: string[];
  forceLightMode?: boolean;
}

export const ChartsSection = forwardRef<HTMLDivElement, ChartsSectionProps>(({
  healthHistory,
  pestHistory,
  topPests,
  forceLightMode = false
}, ref) => {

  // Dynamic styles based on mode
  const containerClass = forceLightMode
    ? "bg-white p-4 rounded-xl shadow-sm border border-gray-200"
    : "bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700";

  const textClass = forceLightMode
    ? "text-gray-900"
    : "text-gray-500 dark:text-blue-300";

  const titleClass = `text-sm font-bold uppercase tracking-wider mb-4 ${textClass}`;
  const gridColor = forceLightMode ? "#e5e7eb" : "#374151";
  const textColor = forceLightMode ? "#6b7280" : "#9ca3af";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3 rounded-lg shadow-lg border text-xs ${forceLightMode ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700 text-blue-200'}`}>
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="capitalize">{entry.name}:</span>
              <span className="font-mono font-bold">
                {typeof entry.value === 'number' && entry.value % 1 !== 0 ? entry.value.toFixed(1) : entry.value}
                {entry.unit || ''}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 animate-fade-in">

      {/* 1. CURVA DE SANIDAD (Evolución Temporal) */}
      <div className={`${containerClass} min-h-[350px] flex flex-col`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={titleClass}>Evolución Lotes (30 días)</h3>
          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500 dark:text-blue-300">Tendencia Acumulada</span>
        </div>

        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={healthHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="colorVerde" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorAmarillo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorRojo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: textColor, fontWeight: 'bold' }}
                tickLine={false}
                axisLine={{ stroke: gridColor, strokeWidth: 1 }}
                minTickGap={30}
                label={{ value: 'Fecha', position: 'insideBottom', offset: -10, fill: textColor, fontSize: 11, fontWeight: 'bold' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: textColor, fontWeight: 'bold' }}
                tickLine={false}
                axisLine={false}
                unit="%"
                label={{ value: '% Lotes', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, fontWeight: 'bold' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: textColor, strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="rojo"
                name="Peligro"
                stackId="1"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#colorRojo)"
                unit="%"
              />
              <Area
                type="monotone"
                dataKey="amarillo"
                name="Alerta"
                stackId="1"
                stroke="#eab308"
                strokeWidth={2}
                fill="url(#colorAmarillo)"
                unit="%"
              />
              <Area
                type="monotone"
                dataKey="verde"
                name="Bien"
                stackId="1"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#colorVerde)"
                unit="%"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. PRESIÓN DE PLAGAS (Multi-línea) */}
      <div className={`${containerClass} min-h-[350px] flex flex-col`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={titleClass}>Dinámica de Plagas</h3>
          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-500 dark:text-blue-300">Detecciones Diarias</span>
        </div>

        {topPests.length > 0 ? (
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pestHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: textColor, fontWeight: 'bold' }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor, strokeWidth: 1 }}
                  minTickGap={30}
                  label={{ value: 'Fecha', position: 'insideBottom', offset: -10, fill: textColor, fontSize: 11, fontWeight: 'bold' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: textColor, fontWeight: 'bold' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  label={{ value: 'Detecciones', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, fontWeight: 'bold' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: textColor, strokeWidth: 1 }} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', fontWeight: '500' }} iconType="circle" />

                {topPests.map((pestName, index) => (
                  <Line
                    key={pestName}
                    type="monotone"
                    dataKey={pestName}
                    stroke={PEST_COLORS[index % PEST_COLORS.length]}
                    strokeWidth={3}
                    dot={{ r: 3, strokeWidth: 1 }}
                    activeDot={{ r: 7 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-blue-300 text-xs italic">
            Sin actividad de plagas registrada en el período.
          </div>
        )}
      </div>
    </div>
  );
});

ChartsSection.displayName = 'ChartsSection';
