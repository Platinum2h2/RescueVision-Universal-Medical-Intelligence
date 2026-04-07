import { GoogleGenAI, Type, Modality } from "@google/genai";

export async function callGemini(ai: any, params: any) {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    if (error.message?.includes("quota") || error.message?.includes("429")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw error;
  }
}

export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const response = await callGemini(ai, {
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
}

export interface ARPoint {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  label: string;
  type: 'action' | 'warning' | 'info' | 'anatomy';
}

export interface ImprovisedTool {
  originalItem: string;
  medicalUse: string;
  instructions: string;
  x: number;
  y: number;
}

export interface FirstAidResponse {
  diagnosis: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-100
  steps: string[];
  arPoints: ARPoint[];
  warnings: string[];
  improvisedTools?: ImprovisedTool[];
  hapticPattern?: 'cpr' | 'pressure' | 'steady' | 'rhythmic_breathing';
  anatomyOverlay?: 'skeleton' | 'circulatory' | 'respiratory' | 'nervous';
  shockProbability?: number; // 0-100
  predictiveAnalytics?: {
    timeToCriticalityMin: number;
    organSystemRisk: { system: string; riskLevel: number }[];
    survivalProbability: number;
  };
  multiSpectralAnalysis?: {
    hypoxiaDetection: number; // 0-1
    internalBleedingProbability: number; // 0-1
    tissueViability: number; // 0-1
  };
  woundMetrics?: {
    lengthMm: number;
    depthMm: number;
    type: string;
    surfaceAreaMm2: number;
  };
}

export async function analyzeInjury(farImage: string, closeupImage: string): Promise<FirstAidResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are a professional emergency medical assistant. 
    Analyze these two images of a medical issue:
    1. Far view (context)
    2. Closeup view (detail)
    
    Provide immediate first aid instructions.
    Identify specific points in the CLOSEUP image where actions should be taken.
    Return the response in JSON format.
    
    The 'arPoints' should be coordinates (x, y from 0-100) relative to the CLOSEUP image.
    Include a 'confidence' score (0-100) based on image clarity and diagnostic certainty.
  `;

  const response = await callGemini(ai, {
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: farImage.split(',')[1] } },
          { inlineData: { mimeType: "image/jpeg", data: closeupImage.split(',')[1] } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          severity: { 
            type: Type.STRING,
            enum: ['low', 'medium', 'high', 'critical']
          },
          confidence: { type: Type.NUMBER },
          steps: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          arPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['action', 'warning', 'info'] }
              },
              required: ['x', 'y', 'label', 'type']
            }
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['diagnosis', 'severity', 'confidence', 'steps', 'arPoints', 'warnings']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeLiveFrame(
  frameImage: string, 
  context: string = "", 
  userSpeech: string = ""
): Promise<FirstAidResponse & { nextQuestion?: string, arHumanAction?: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    You are a Universal Medical Intelligence (UMI) in a high-stress medical environment.
    You are an expert in clinical diagnosis, surgical navigation, laboratory analysis, nursing protocols, and biomedical engineering.
    
    CURRENT CONTEXT: ${context}
    USER SAID: "${userSpeech}"
    
    DIAGNOSTIC PROTOCOL:
    1. Analyze the visual frame immediately.
    2. If the medical emergency is unclear, ask ONE specific preliminary question to determine the exact issue and what to do next.
    3. Do NOT repeat questions. If the user has answered or the situation is clear, move immediately to ACTIONS.
    4. Provide DIRECT, QUICK ACTIONS in 'steps' to resolve the emergency.
    5. For 'critical' severity, prioritize immediate life-saving maneuvers.
    6. If you are providing actions or do not have a question, omit the 'nextQuestion' field entirely or leave it empty. Do NOT return the string "null".
    
    TASK:
    1. Identify the medical specialty (CLINICAL, SURGICAL, LAB, BIOMEDICAL).
    2. Provide 'arHumanAction' for realistic medical poses.
    3. Provide 'predictiveAnalytics' for survival probability.
    4. Provide 'multiSpectralAnalysis' for tissue viability.
    5. Provide 'woundMetrics' for geometric analysis.
    6. Provide 'arPoints' for spatial annotations on the image.
    
    Return the response in JSON format.
  `;

  const response = await callGemini(ai, {
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: frameImage.split(',')[1] } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['low', 'medium', 'high', 'critical'] },
          confidence: { type: Type.NUMBER },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          nextQuestion: { type: Type.STRING, description: "The next question to ask the user verbally." },
          arHumanAction: { type: Type.STRING, description: "Key for the AR human animation/pose." },
          hapticPattern: { type: Type.STRING, enum: ['cpr', 'pressure', 'steady', 'rhythmic_breathing'] },
          anatomyOverlay: { type: Type.STRING, enum: ['skeleton', 'circulatory', 'respiratory', 'nervous'] },
          predictiveAnalytics: {
            type: Type.OBJECT,
            properties: {
              timeToCriticalityMin: { type: Type.NUMBER },
              organSystemRisk: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    system: { type: Type.STRING },
                    riskLevel: { type: Type.NUMBER }
                  },
                  required: ['system', 'riskLevel']
                }
              },
              survivalProbability: { type: Type.NUMBER }
            },
            required: ['timeToCriticalityMin', 'organSystemRisk', 'survivalProbability']
          },
          multiSpectralAnalysis: {
            type: Type.OBJECT,
            properties: {
              hypoxiaDetection: { type: Type.NUMBER },
              internalBleedingProbability: { type: Type.NUMBER },
              tissueViability: { type: Type.NUMBER }
            },
            required: ['hypoxiaDetection', 'internalBleedingProbability', 'tissueViability']
          },
          woundMetrics: {
            type: Type.OBJECT,
            properties: {
              lengthMm: { type: Type.NUMBER },
              depthMm: { type: Type.NUMBER },
              surfaceAreaMm2: { type: Type.NUMBER },
              type: { type: Type.STRING }
            },
            required: ['lengthMm', 'depthMm', 'surfaceAreaMm2', 'type']
          },
          arPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['action', 'warning', 'info'] }
              },
              required: ['x', 'y', 'label', 'type']
            }
          },
          improvisedTools: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalItem: { type: Type.STRING },
                medicalUse: { type: Type.STRING },
                instructions: { type: Type.STRING },
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ['originalItem', 'medicalUse', 'instructions', 'x', 'y']
            }
          },
          warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['diagnosis', 'severity', 'confidence', 'steps', 'arPoints', 'warnings']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export interface GeometricMetrics {
  distanceFromCenterMm: number;
  angularDeviationDeg: number;
  occlusionPercentage: number;
  coverageRatio: number;
}

export interface VerificationResult {
  success: boolean;
  feedback: string;
  semanticScore: number; // 0-1
  geometricScore: number; // 0-1
  uncertainty: number; // 0-1
  finalConfidence: number; // 0-1
  metrics: GeometricMetrics;
  explanationPoints: { x: number; y: number; label: string; type: 'error' | 'success' }[];
}

export interface RadiologyResponse {
  specialty: 'NEURO' | 'CARDIO' | 'ORTHO' | 'ABDOMINAL' | 'THORACIC';
  findings: string[];
  diagnosis: string;
  differentialDiagnosis: string[];
  treatmentPlan: string[];
  recoveryPlan?: string[];
  surgicalPlan?: string[];
  confidence: number;
  trainingInstructions: {
    step: string;
    whatToLookFor: string;
    anatomicalLandmarks: string[];
    deviceOperation?: string;
  }[];
  arPoints: ARPoint[];
  gradCamSimulatedHeatmap?: { x: number; y: number; intensity: number }[];
}

export async function getRadiologyDeviceGuidance(scanType: string): Promise<{ instructions: string[]; safetyWarnings: string[]; optimalSettings: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  const prompt = `
    You are a Senior Radiology Technician and Educator.
    The user wants to perform a: ${scanType}.
    
    Provide:
    1. Step-by-step instructions on how to operate the radiology device (MRI/CT/X-Ray) for this specific scan.
    2. Critical safety warnings (e.g., metal for MRI, radiation for CT).
    3. Optimal device settings (e.g., T1/T2 weighting, slice thickness, kVp/mAs).
    
    Return the response in JSON format.
  `;

  const response = await callGemini(ai, {
    model,
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          optimalSettings: { type: Type.STRING }
        },
        required: ['instructions', 'safetyWarnings', 'optimalSettings']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeRadiology(image: string, context: string = "", isTraining: boolean = false): Promise<RadiologyResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  const prompt = isTraining ? `
    You are a Senior Consultant Radiologist and Medical Educator. 
    Analyze this medical imaging (MRI/CT/X-Ray) for TRAINING purposes.
    
    TASK:
    1. Identify the specialty and anatomical region.
    2. Provide detailed clinical findings.
    3. Provide a primary diagnosis and a list of differential diagnoses.
    4. Provide a comprehensive TREATMENT PLAN, RECOVERY PLAN, and if applicable, a SURGICAL PLAN.
    5. TRAINING MODE: Provide a step-by-step instructional guide for a junior radiologist.
       - Include instructions on how to OPERATE the radiology device (MRI/CT) for this specific scan.
       - What should they look for first? 
       - Which anatomical landmarks are critical here?
    6. AR ANNOTATIONS: Identify coordinates (x, y 0-100) for key findings or landmarks.
    7. HEATMAP: Identify areas of highest diagnostic interest.
    
    Return the response in JSON format.
  ` : `
    You are a Universal Medical Intelligence (UMI) in a high-stress Radiology environment.
    Analyze this medical imaging (MRI/CT/X-Ray) for LIVE diagnostic support.
    
    TASK:
    1. Identify the specialty and anatomical region.
    2. Provide detailed clinical findings.
    3. Provide a primary diagnosis and a list of differential diagnoses.
    4. Provide a comprehensive TREATMENT PLAN, RECOVERY PLAN, and if applicable, a SURGICAL PLAN.
    5. AR ANNOTATIONS: Identify coordinates (x, y 0-100) for key findings or landmarks.
    6. HEATMAP: Identify areas of highest diagnostic interest.
    
    Return the response in JSON format.
  `;

  const response = await callGemini(ai, {
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { text: `Context: ${context}` },
          { inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          specialty: { type: Type.STRING, enum: ['NEURO', 'CARDIO', 'ORTHO', 'ABDOMINAL', 'THORACIC'] },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          diagnosis: { type: Type.STRING },
          differentialDiagnosis: { type: Type.ARRAY, items: { type: Type.STRING } },
          treatmentPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          recoveryPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          surgicalPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          confidence: { type: Type.NUMBER },
          trainingInstructions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.STRING },
                whatToLookFor: { type: Type.STRING },
                anatomicalLandmarks: { type: Type.ARRAY, items: { type: Type.STRING } },
                deviceOperation: { type: Type.STRING }
              },
              required: ['step', 'whatToLookFor', 'anatomicalLandmarks']
            }
          },
          arPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['action', 'warning', 'info', 'anatomy'] }
              },
              required: ['x', 'y', 'label', 'type']
            }
          },
          gradCamSimulatedHeatmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                intensity: { type: Type.NUMBER }
              },
              required: ['x', 'y', 'intensity']
            }
          }
        },
        required: ['specialty', 'findings', 'diagnosis', 'differentialDiagnosis', 'treatmentPlan', 'confidence', 'trainingInstructions', 'arPoints']
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function verifyStep(stepDescription: string, stepImage: string): Promise<VerificationResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";
  
  // Research-grade prompt for hybrid semantic + geometric analysis
  const prompt = `
    Analyze this image to verify the following first aid step: "${stepDescription}"
    
    Perform a Hybrid Semantic-Geometric Analysis:
    1. Semantic: Does the action match the medical protocol?
    2. Geometric: 
       - Calculate distance from the wound center in estimated mm.
       - Calculate angular deviation of splints/bandages in degrees.
       - Estimate occlusion percentage of the injury site.
       - Calculate coverage ratio of the dressing.
    
    Provide an 'uncertainty' score based on image noise, lighting, and diagnostic ambiguity.
    
    Return JSON with:
    - success: boolean
    - feedback: string
    - semanticScore: 0-1
    - geometricScore: 0-1
    - uncertainty: 0-1
    - metrics: { distanceFromCenterMm, angularDeviationDeg, occlusionPercentage, coverageRatio }
    - explanationPoints: Array of { x, y, label, type: 'error'|'success' } for visual explainability.
  `;

  const response = await callGemini(ai, {
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: stepImage.split(',')[1] } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          success: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          semanticScore: { type: Type.NUMBER },
          geometricScore: { type: Type.NUMBER },
          uncertainty: { type: Type.NUMBER },
          metrics: {
            type: Type.OBJECT,
            properties: {
              distanceFromCenterMm: { type: Type.NUMBER },
              angularDeviationDeg: { type: Type.NUMBER },
              occlusionPercentage: { type: Type.NUMBER },
              coverageRatio: { type: Type.NUMBER }
            },
            required: ['distanceFromCenterMm', 'angularDeviationDeg', 'occlusionPercentage', 'coverageRatio']
          },
          explanationPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['error', 'success'] }
              },
              required: ['x', 'y', 'label', 'type']
            }
          }
        },
        required: ['success', 'feedback', 'semanticScore', 'geometricScore', 'uncertainty', 'metrics', 'explanationPoints']
      }
    }
  });

  const raw = JSON.parse(response.text || "{}");
  
  // Research Algorithm: Final Confidence Calculation
  // Formula: w1(Semantic) + w2(Geometric) - w3(Uncertainty)
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;
  const finalConfidence = (raw.semanticScore * w1) + (raw.geometricScore * w2) - (raw.uncertainty * w3);

  return {
    ...raw,
    finalConfidence: Math.max(0, Math.min(1, finalConfidence))
  };
}
