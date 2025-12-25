
import { useState, useRef } from 'react';

export interface MediaRecorderState {
    isRecording: boolean;
    audioBlobUrl: string | null;
    audioDuration: number;
    hasAudio: boolean;
}

export const useMediaRecorder = () => {
  const [mediaState, setMediaState] = useState<MediaRecorderState>({
    isRecording: false,
    audioBlobUrl: null,
    audioDuration: 0,
    hasAudio: false
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // OPTIMIZATION: Low bitrate for voice notes (32kbps)
        const options = {
            audioBitsPerSecond: 32000,
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
                ? 'audio/webm;codecs=opus' 
                : 'audio/webm'
        };

        mediaRecorderRef.current = new MediaRecorder(stream, options);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setMediaState(prev => ({ ...prev, audioBlobUrl: audioUrl }));
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setMediaState(prev => ({ ...prev, isRecording: true, audioDuration: 0, hasAudio: false, audioBlobUrl: null }));
        
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = window.setInterval(() => {
          setMediaState(prev => ({ ...prev, audioDuration: prev.audioDuration + 1 }));
        }, 1000);

    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Error al acceder al micrófono. Verifique los permisos.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
    }
    setMediaState(prev => ({ ...prev, isRecording: false, hasAudio: true }));
  };

  const toggleRecording = () => {
      if (mediaState.isRecording) {
          stopRecording();
      } else {
          startRecording();
      }
  };

  const resetRecording = () => {
      setMediaState({
        isRecording: false,
        audioBlobUrl: null,
        audioDuration: 0,
        hasAudio: false
      });
      audioChunksRef.current = [];
  };

  return {
    ...mediaState,
    startRecording,
    stopRecording,
    toggleRecording,
    resetRecording
  };
};
