
import React, { useEffect, useState } from 'react';
import { Cloud, Droplets, Wind, Sun, CloudRain, Thermometer, Loader2, MapPin } from 'lucide-react';
import { fetchWeather, WeatherInfo, getWeatherConditionLabel } from '../../services/weatherService';

interface WeatherWidgetProps {
  lat?: number;
  lng?: number;
  locationName?: string; // e.g. "Campo La Estancia"
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ lat, lng, locationName }) => {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Check undefined explicitly to allow 0 coordinates (edge case)
    if (lat !== undefined && lng !== undefined) {
      setLoading(true);
      setError(false);
      fetchWeather(lat, lng)
        .then(data => {
          if (data) setWeather(data);
          else setError(true);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }
  }, [lat, lng]);

  if (lat === undefined || lng === undefined) return null;

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full flex items-center justify-center min-h-[140px]">
       <div className="flex flex-col items-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <span className="text-xs">Actualizando clima...</span>
       </div>
    </div>
  );

  if (error || !weather) return (
     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full flex items-center justify-center min-h-[140px]">
        <div className="flex flex-col items-center text-gray-400">
           <Cloud className="w-8 h-8 mb-2 opacity-50" />
           <span className="text-xs">Clima no disponible</span>
        </div>
     </div>
  );

  const getWeatherIcon = (code: number) => {
    if (code === 0 || code === 1) return <Sun className="w-8 h-8 text-amber-500" />;
    if (code === 2 || code === 3) return <Cloud className="w-8 h-8 text-gray-400" />;
    if (code >= 51 && code <= 67) return <CloudRain className="w-8 h-8 text-blue-400" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-8 h-8 text-blue-600" />;
    if (code >= 95) return <Wind className="w-8 h-8 text-purple-500" />;
    return <Cloud className="w-8 h-8 text-gray-400" />;
  };

  const getSmallIcon = (code: number) => {
    if (code >= 51) return <CloudRain className="w-4 h-4 text-blue-400" />;
    return <Sun className="w-4 h-4 text-amber-500" />;
  };

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-900 dark:to-slate-900 rounded-xl shadow-lg border border-blue-400/30 text-white overflow-hidden relative animate-fade-in">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Cloud className="w-24 h-24" />
      </div>
      
      <div className="p-4 relative z-10">
        <div className="flex justify-between items-start mb-4">
           <div>
              <h3 className="text-sm font-medium text-blue-100 flex items-center gap-1">
                 <MapPin className="w-3.5 h-3.5" /> {locationName || 'Ubicación Actual'}
              </h3>
              <div className="mt-1 flex items-baseline">
                 <span className="text-3xl font-bold">{Math.round(weather.current.temp)}°</span>
                 <span className="ml-2 text-sm text-blue-100 font-medium">{weather.current.conditionLabel}</span>
              </div>
           </div>
           <div className="bg-white/20 backdrop-blur-md p-2 rounded-lg">
              {getWeatherIcon(weather.current.conditionCode)}
           </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
           <div className="flex items-center gap-2 text-xs bg-black/10 rounded px-2 py-1.5">
              <Wind className="w-4 h-4 text-blue-200" />
              <span>{weather.current.windSpeed} km/h</span>
           </div>
           <div className="flex items-center gap-2 text-xs bg-black/10 rounded px-2 py-1.5">
              <Droplets className="w-4 h-4 text-blue-200" />
              <span>{weather.current.humidity}% Hum.</span>
           </div>
        </div>

        <div className="border-t border-white/10 pt-3">
           <div className="grid grid-cols-3 gap-2 text-center divide-x divide-white/10">
              {weather.daily.map((day, idx) => {
                 const today = new Date().toISOString().split('T')[0];
                 const isToday = day.date === today;
                 return (
                 <div key={idx} className="flex flex-col items-center">
                    <span className="text-[10px] text-blue-200 uppercase mb-1">
                        {isToday ? 'Hoy' : new Date(day.date + 'T12:00:00').toLocaleDateString(undefined, {weekday: 'short'})}
                    </span>
                    <div className="mb-1">{getSmallIcon(day.conditionCode)}</div>
                    <span className="text-xs font-bold">{Math.round(day.maxTemp)}° <span className="text-[9px] font-normal text-blue-300">/ {Math.round(day.minTemp)}°</span></span>
                    {day.rainProb > 0 && (
                        <span className="text-[9px] text-blue-200 flex items-center mt-0.5">
                            <Droplets className="w-2 h-2 mr-0.5" />{day.rainProb}%
                        </span>
                    )}
                 </div>
                 );
              })}
           </div>
        </div>
      </div>
    </div>
  );
};
