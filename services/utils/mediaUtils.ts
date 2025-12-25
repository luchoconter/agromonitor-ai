
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export const uploadMedia = async (blobUrl: string, path: string): Promise<string> => {
    // Timeout de 5 segundos para evitar colgarse en modo offline
    console.log('📤 Iniciando subida de media:', path);
    const uploadPromise = (async () => {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        console.log('📦 Blob obtenido, tamaño:', blob.size, 'bytes');
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);
        console.log('✅ Media subida exitosamente:', downloadURL);
        return downloadURL;
    })();
    
    const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Firebase Storage no responde (5s)')), 5000)
    );
    
    return Promise.race([uploadPromise, timeoutPromise]);
};

export const deleteMedia = async (url: string | null | undefined): Promise<void> => {
    if (!url) return;
    try {
        // Create a reference from the HTTPS URL
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
    } catch (error) {
        // We log warning but don't throw, to allow the database record deletion to proceed
        console.warn("Warning: Could not delete file from storage (might already be missing)", error);
    }
};

export const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onerror = () => reject(new Error('Error leyendo archivo'));
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onerror = () => reject(new Error('Error cargando imagen'));
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1920;
                    
                    let width = img.width;
                    let height = img.height;
                    
                    // Calcular escala manteniendo aspect ratio
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height = height * (MAX_WIDTH / width);
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width = width * (MAX_HEIGHT / height);
                            height = MAX_HEIGHT;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('No se pudo obtener contexto 2D'));
                        return;
                    }
                    
                    // Dibujar imagen redimensionada
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convertir a Blob con compresión JPEG
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                console.log(`📸 Foto comprimida: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`);
                                resolve(blob);
                            } else {
                                reject(new Error('Error al crear blob de imagen'));
                            }
                        },
                        'image/jpeg',
                        0.85 // 85% calidad para balance tamaño/calidad
                    );
                } catch (error) {
                    reject(error);
                }
            };
            
            img.src = e.target!.result as string;
        };
        
        reader.readAsDataURL(file);
    });
};

export const processUploadQueue = async () => { 
    console.log("Processing queue..."); 
};
