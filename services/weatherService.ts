
// Using Open-Meteo API (No API Key required) to provide immediate value without configuration.
// It mimics OpenWeatherMap features like Current Weather and Daily Forecast.

export interface WeatherInfo {
  current: {
    temp: number;
    humidity: number;
    windSpeed: number;
    conditionCode: number;
    conditionLabel: string;
  };
  daily: {
    date: string; // ISO
    maxTemp: number;
    minTemp: number;
    rainProb: number;
    conditionCode: number;
  }[];
}

const WMO_CODES: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente Claro',
  2: 'Parcialmente Nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna Ligera',
  53: 'Llovizna Moderada',
  55: 'Llovizna Densa',
  61: 'Lluvia Leve',
  63: 'Lluvia Moderada',
  65: 'Lluvia Fuerte',
  71: 'Nieve Leve',
  73: 'Nieve Moderada',
  75: 'Nieve Fuerte',
  77: 'Granizo',
  80: 'Lluvia/Chubascos Leves',
  81: 'Lluvia/Chubascos Mod.',
  82: 'Lluvia/Chubascos Fuertes',
  95: 'Tormenta Eléctrica',
  96: 'Tormenta con Granizo Leve',
  99: 'Tormenta con Granizo Fuerte'
};

export const getWeatherConditionLabel = (code: number): string => {
  return WMO_CODES[code] || 'Desconocido';
};

export const fetchWeather = async (lat: number, lng: number): Promise<WeatherInfo | null> => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=4`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather API Error: ${response.statusText}`);
    
    const data = await response.json();
    
    if (data.error) throw new Error(data.reason || 'Open-Meteo API Error');
    if (!data.current || !data.daily) throw new Error('Invalid weather data format');
    
    const current = {
      temp: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      conditionCode: data.current.weather_code,
      conditionLabel: getWeatherConditionLabel(data.current.weather_code)
    };

    const daily = data.daily.time.map((time: string, index: number) => ({
      date: time,
      maxTemp: data.daily.temperature_2m_max[index],
      minTemp: data.daily.temperature_2m_min[index],
      rainProb: data.daily.precipitation_probability_max[index],
      conditionCode: data.daily.weather_code[index]
    })).slice(0, 3); // Get today + next 2 days (or today included) - logic handled by slice

    return { current, daily };

  } catch (error) {
    console.warn("Failed to fetch weather:", error);
    return null;
  }
};
