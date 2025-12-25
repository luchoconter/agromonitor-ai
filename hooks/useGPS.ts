
import { useState, useEffect } from 'react';
import { GeoLocation } from '../types';

export const useGPS = () => {
  const [currentLocation, setCurrentLocation] = useState<GeoLocation | undefined>(undefined);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'locked' | 'error'>('idle');

  useEffect(() => {
    if (!('geolocation' in navigator)) {
        setGpsStatus('error');
        return;
    }
    
    setGpsStatus('searching');
    
    const successHandler = (position: GeolocationPosition) => {
        setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
        });
        setGpsStatus('locked');
    };

    const errorHandler = (error: GeolocationPositionError) => {
        console.warn("GPS Error:", error.code, error.message);
        
        // Code 1: PERMISSION_DENIED
        // Code 2: POSITION_UNAVAILABLE
        // Code 3: TIMEOUT
        
        if (error.code === 1) { 
            // Only set error status if user explicitly denied permission
            setGpsStatus('error');
        } else {
            // For Timeout or Position Unavailable (weak signal), keep 'searching' state
            // giving the user feedback that we are still trying to connect.
            setGpsStatus('searching');
        }
    };

    const options = { 
        enableHighAccuracy: true, 
        timeout: 20000, 
        maximumAge: 5000 
    };
    
    const watchId = navigator.geolocation.watchPosition(successHandler, errorHandler, options);

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { currentLocation, gpsStatus };
};
