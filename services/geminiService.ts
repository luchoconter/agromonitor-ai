import { GoogleGenAI, Type } from "@google/genai";

// Initialize the API client with Vite environment variable
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY || '' });

export const generateAgronomicAdvice = async (
  companyName: string,
  fieldName: string,
  plotName: string,
  seasonName: string
): Promise<string> => {
  if (!import.meta.env.VITE_API_KEY) return "API Key no configurada.";

  try {
    const prompt = `
      Actúa como un ingeniero agrónomo experto.
      Genera un breve checklist de 5 puntos clave para iniciar el monitoreo en el siguiente contexto:
      - Empresa: ${companyName}
      - Campo: ${fieldName}
      - Lote: ${plotName}
      - Campaña: ${seasonName}
      Devuelve la respuesta en formato Markdown limpio.
    `;
    // Fix: Using gemini-3-flash-preview for basic text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No se pudo generar el consejo.";
  } catch (error) {
    console.error("Error calling Gemini:", error);
    return "Error al conectar con el asistente.";
  }
};

// NUEVO: Análisis estratégico del Dashboard (Sin Audios)
export const generateDashboardAnalysis = async (
  context: {
    totalSummaries: number,
    statusCounts: Record<string, number>,
    topPests: { name: string, count: number }[],
    // Texto completo de notas para análisis semántico (SOLO INGENIERO)
    allNotes: string[] 
  },
  scope: string = "Global" // Alcance del análisis
): Promise<string> => {
  if (!import.meta.env.VITE_API_KEY) return "Servicio de IA no disponible (API Key).";

  try {
    const prompt = `
      Rol: Eres un Ingeniero Agrónomo Senior redactando un INFORME EJECUTIVO para el DUEÑO DEL CAMPO (Productor).
      Contexto: ${scope}
      Objetivo: Informar el estado de los cultivos y justificar las decisiones técnicas tomadas.
      
      DATOS DUROS:
      - Lotes Relevados: ${context.totalSummaries}
      - Situación Sanitaria: 
          Verde (Sin riesgo): ${context.statusCounts['verde'] || 0}
          Amarillo (Alerta/Monitorear): ${context.statusCounts['amarillo'] || 0}
          Rojo (Peligro/Aplicar): ${context.statusCounts['rojo'] || 0}
      - Plagas detectadas (Frecuencia): ${context.topPests.map(p => `${p.name} (${p.count})`).join(', ')}

      NOTAS TÉCNICAS DEL INGENIERO (Tus decisiones campo por campo):
      "${context.allNotes.join('"; "')}"

      INSTRUCCIONES DE REDACCIÓN:
      Genera un texto formal, directo y profesional (formato Markdown, max 200 palabras) con esta estructura:

      1. **Resumen de Visita:** 
         Un párrafo breve sintetizando la recorrida. Ej: "Se relevaron X lotes. En general, el estado sanitario es [Bueno/Regular]...".
      
      2. **Focos de Atención y Estrategia:**
         Si hay lotes en ROJO o AMARILLO, menciona explícitamente cuáles son y qué acción determinaste (basado en tus notas). Ej: "Se detectó alta presión de Arañuela en lotes X e Y, por lo que se procedió a indicar aplicación inmediata". 
         Si todo está Verde, destaca la buena evolución.

      3. **Próximos Pasos:**
         Una línea final de recomendación general (ej: "Continuar monitoreo en 7 días" o "Evaluar control químico según evolución climática").

      IMPORTANTE:
      - Habla directamente al Productor.
      - Usa vocabulario técnico pero claro.
      - NO inventes datos. Si las notas del ingeniero están vacías, da un reporte genérico basado en los números (Verde/Rojo).
    `;

    // Fix: Using gemini-3-flash-preview for dashboard analysis
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "No se pudo generar el análisis.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Ocurrió un error al procesar el análisis inteligente.";
  }
};

// NUEVO: Generación de Narrativa para Reporte PDF (Pensamiento Intensivo)
export interface ReportNarrative {
  resumen_labor: string;
  analisis_sanitario: string;
  conclusion_estrategica: string;
}

export const generatePdfReportNarrative = async (
  context: {
    companyName: string;
    fieldName: string;
    dateRange: string;
    hectares: number;
    plotsCount: number;
    samplesCount: number;
    pestsFound: { name: string, max: number, unit: string }[];
    criticalPlots: number;
  }
): Promise<ReportNarrative> => {
  if (!import.meta.env.VITE_API_KEY) {
    return {
      resumen_labor: "Análisis no disponible (API Key faltante).",
      analisis_sanitario: "",
      conclusion_estrategica: ""
    };
  }

  try {
    // Definimos el Schema para respuesta estructurada JSON
    const schema = {
      type: Type.OBJECT,
      properties: {
        resumen_labor: { type: Type.STRING, description: "Párrafo destacando el esfuerzo, cobertura y profesionalismo del relevamiento." },
        analisis_sanitario: { type: Type.STRING, description: "Análisis técnico de las plagas encontradas, presión y severidad." },
        conclusion_estrategica: { type: Type.STRING, description: "Valor para el cliente, justificación del servicio y cierre profesional." }
      },
      required: ["resumen_labor", "analisis_sanitario", "conclusion_estrategica"]
    };

    const prompt = `
      Eres un Ingeniero Agrónomo Senior de Argentina redactando un informe técnico oficial para un cliente productor.
      Tu objetivo es VALORIZAR el trabajo de monitoreo realizado, demostrando profesionalismo y precisión técnica.
      
      IMPORTANTE - EXACTITUD DE DATOS:
      - Utiliza EXACTAMENTE los números proporcionados en "DATOS DEL RELEVAMIENTO". NO inventes hectáreas ni conteos.
      - CONFÍA CIEGAMENTE EN: Hectáreas (${context.hectares.toFixed(1)}), Lotes (${context.plotsCount}), Muestreos (${context.samplesCount}).
      - Para el Análisis Fitosanitario, usa la lista "Detalle de Plagas" provista. Allí ya se indica la frecuencia y el máximo encontrado. Úsalos para ser preciso (ej: "se detectó alta incidencia de X con picos de Y").

      DATOS DEL RELEVAMIENTO:
      - Cliente: ${context.companyName}
      - Campo: ${context.fieldName}
      - Período: ${context.dateRange}
      - Hectáreas Relevadas: ${context.hectares.toFixed(1)}
      - Cantidad de Lotes: ${context.plotsCount}
      - Estaciones de Muestreo (Intensidad): ${context.samplesCount}
      - Lotes en situación crítica (Rojo): ${context.criticalPlots}
      - Detalle de Plagas (Nombre y estadísticas calculadas): ${context.pestsFound.map(p => p.name).join('; ')}

      GENERA 3 SECCIONES DE TEXTO (Sin títulos, solo el contenido):

      1. resumen_labor (Max 60 palabras):
         Enfécate en el esfuerzo logístico y la exhaustividad. Menciona explícitamente las ${context.hectares.toFixed(0)} hectáreas relevadas en los ${context.plotsCount} lotes mediante ${context.samplesCount} estaciones de muestreo.
         Ej: "Se procedió al relevamiento sistemático de ${context.hectares.toFixed(0)} hectáreas..."

      2. analisis_sanitario (Max 80 palabras):
         Describe la situación fitosanitaria basándote ÚNICAMENTE en las plagas listadas y sus valores máximos/promedios.
         Si hay plagas con valores altos (Max alto), habla de "incidencia significativa". Si los valores son bajos, destaca la "buena sanidad".
         Menciona las plagas principales por su nombre exacto.

      3. conclusion_estrategica (Max 60 palabras):
         Cierra reforzando el valor de esta información para la toma de decisiones económicas (ahorro de insumos o protección de rinde).
    `;

    // Fix: Using gemini-3-pro-preview for complex reasoning tasks with JSON output
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });
    
    // Parseo seguro del JSON
    const text = response.text || "{}";
    try {
        const json = JSON.parse(text);
        return {
            resumen_labor: json.resumen_labor || "Informe generado automáticamente.",
            analisis_sanitario: json.analisis_sanitario || "Revise los gráficos adjuntos.",
            conclusion_estrategica: json.conclusion_estrategica || "Datos listos para la toma de decisiones."
        };
    } catch (e) {
        return {
            resumen_labor: text, 
            analisis_sanitario: "", 
            conclusion_estrategica: ""
        };
    }

  } catch (error) {
    console.error("Gemini PDF Report Error:", error);
    return {
      resumen_labor: "No se pudo generar el análisis inteligente por falta de conexión.",
      analisis_sanitario: "",
      conclusion_estrategica: ""
    };
  }
};