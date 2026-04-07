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
    console.log("Generating speech for:", text);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const response = await callGemini(ai, {
      model: "gemini-2.5-flash-preview-tts",
      contents: [
        { parts: [{ text: `Say clearly and professionally: ${text}` }] },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Zephyr" },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      console.log("Speech generation successful");
    } else {
      console.warn("Speech generation returned no audio data");
    }
    return base64Audio || null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
}

export interface ARPoint {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
  label: string;
  type: "action" | "warning" | "info" | "anatomy";
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
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-100
  steps: string[];
  arPoints: ARPoint[];
  warnings: string[];
  improvisedTools?: ImprovisedTool[];
  hapticPattern?: "cpr" | "pressure" | "steady" | "rhythmic_breathing";
  anatomyOverlay?: "skeleton" | "circulatory" | "respiratory" | "nervous";
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

function getImageData(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = normalizeText(step);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type ChokingLiveResponse = FirstAidResponse & {
  nextQuestion?: string;
  arHumanAction?: string;
  phase?: "question" | "action" | "unresponsive";
};

function buildConsciousSevereResponse(): ChokingLiveResponse {
  return {
    diagnosis: "Severe choking suspected",
    severity: "critical",
    confidence: 92,
    phase: "action",
    steps: [
      "Call emergency services now.",
      "Give 5 hard back blows between the shoulder blades.",
      "If still blocked, give abdominal thrusts just above the navel.",
      "Repeat back blows and thrusts until the object comes out or they become unresponsive.",
    ],
    arHumanAction: "heimlich",
    arPoints: [
      { x: 50, y: 34, label: "Back blows here", type: "action" },
      { x: 50, y: 57, label: "Abdominal thrust point", type: "action" },
      { x: 50, y: 20, label: "Watch airway and face color", type: "warning" },
    ],
    warnings: [
      "Do not do blind finger sweeps.",
      "If the person becomes limp or unresponsive, start CPR immediately.",
    ],
    hapticPattern: "pressure",
    anatomyOverlay: "respiratory",
  };
}

function buildConsciousPartialResponse(): ChokingLiveResponse {
  return {
    diagnosis: "Partial airway blockage possible",
    severity: "high",
    confidence: 86,
    phase: "action",
    steps: [
      "Tell them to keep coughing forcefully.",
      "Stay with them and watch for worsening breathing or silence.",
      "Call emergency services now if they cannot clear it quickly or start struggling to speak.",
    ],
    arHumanAction: "monitor_airway",
    arPoints: [
      { x: 50, y: 20, label: "Watch mouth and breathing", type: "warning" },
      { x: 50, y: 30, label: "Airway focus", type: "info" },
    ],
    warnings: [
      "Do not hit the back if they are coughing forcefully and moving air well.",
      "If coughing stops and they cannot speak, switch to back blows and abdominal thrusts.",
    ],
    hapticPattern: "steady",
    anatomyOverlay: "respiratory",
  };
}

function buildUnresponsiveResponse(): ChokingLiveResponse {
  return {
    diagnosis: "Choking emergency with unresponsiveness",
    severity: "critical",
    confidence: 96,
    phase: "unresponsive",
    steps: [
      "Call emergency services now and get an AED if available.",
      "Lower them to the ground and start CPR.",
      "After each set, look in the mouth for a visible object and remove it only if you can clearly see it.",
      "Continue CPR until the airway clears or help takes over.",
    ],
    arHumanAction: "cpr",
    arPoints: [
      { x: 50, y: 42, label: "Center of chest for compressions", type: "action" },
      { x: 50, y: 18, label: "Check mouth only for visible object", type: "warning" },
    ],
    warnings: [
      "Do not do blind finger sweeps.",
      "If not breathing normally, continue CPR until emergency responders arrive.",
    ],
    hapticPattern: "cpr",
    anatomyOverlay: "respiratory",
  };
}

function buildClarifyingQuestionResponse(alreadyAsked: boolean): ChokingLiveResponse {
  return {
    diagnosis: "Possible choking emergency",
    severity: "high",
    confidence: 68,
    phase: alreadyAsked ? "action" : "question",
    steps: alreadyAsked
      ? [
          "If they cannot speak or cough, start 5 back blows now.",
          "Then give abdominal thrusts and repeat until the object clears or they become unresponsive.",
          "Call emergency services immediately.",
        ]
      : [
          "Stay with the person and be ready to act immediately.",
          "If they cannot speak or cough, start back blows right away.",
          "Call emergency services if breathing is worsening.",
        ],
    arHumanAction: alreadyAsked ? "heimlich" : "assess_airway",
    arPoints: [
      { x: 50, y: 22, label: "Check if air is moving", type: "warning" },
      { x: 50, y: 34, label: "Prepare for back blows", type: "action" },
    ],
    warnings: [
      "Act immediately if they are silent, blue, or unable to breathe.",
    ],
    nextQuestion: alreadyAsked ? undefined : "Can they speak or cough?",
    hapticPattern: "pressure",
    anatomyOverlay: "respiratory",
  };
}

function sanitizeLiveResponse(
  raw: Partial<ChokingLiveResponse>,
  fallback: ChokingLiveResponse,
  alreadyAskedQuestion: boolean,
): ChokingLiveResponse {
  const nextQuestion = raw.nextQuestion?.trim();
  const shouldSuppressQuestion =
    alreadyAskedQuestion &&
    !!nextQuestion &&
    /speak|cough|conscious|responsive|breathing/.test(normalizeText(nextQuestion));

  return {
    diagnosis: raw.diagnosis || fallback.diagnosis,
    severity:
      raw.severity && ["low", "medium", "high", "critical"].includes(raw.severity)
        ? raw.severity
        : fallback.severity,
    confidence:
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(100, raw.confidence))
        : fallback.confidence,
    phase:
      raw.phase === "question" || raw.phase === "action" || raw.phase === "unresponsive"
        ? raw.phase
        : fallback.phase,
    steps: uniqueSteps(
      Array.isArray(raw.steps) && raw.steps.length > 0 ? raw.steps.slice(0, 4) : fallback.steps,
    ),
    arPoints:
      Array.isArray(raw.arPoints) && raw.arPoints.length > 0
        ? raw.arPoints.slice(0, 4)
        : fallback.arPoints,
    warnings: uniqueSteps(
      Array.isArray(raw.warnings) && raw.warnings.length > 0
        ? raw.warnings.slice(0, 3)
        : fallback.warnings,
    ),
    arHumanAction: raw.arHumanAction || fallback.arHumanAction,
    nextQuestion: shouldSuppressQuestion ? undefined : nextQuestion,
    hapticPattern: raw.hapticPattern || fallback.hapticPattern,
    anatomyOverlay: raw.anatomyOverlay || fallback.anatomyOverlay,
  };
}

export async function analyzeInjury(
  farImage: string,
  closeupImage: string,
): Promise<FirstAidResponse> {
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
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: getImageData(farImage),
            },
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: getImageData(closeupImage),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          diagnosis: { type: Type.STRING },
          severity: {
            type: Type.STRING,
            enum: ["low", "medium", "high", "critical"],
          },
          confidence: { type: Type.NUMBER },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          arPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  enum: ["action", "warning", "info"],
                },
              },
              required: ["x", "y", "label", "type"],
            },
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "diagnosis",
          "severity",
          "confidence",
          "steps",
          "arPoints",
          "warnings",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeLiveFrame(
  frameImage: string,
  context: string = "",
  userSpeech: string = "",
): Promise<FirstAidResponse & { nextQuestion?: string; arHumanAction?: string; phase?: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";

  const combinedContext = normalizeText(`${context} ${userSpeech}`);
  const alreadyAskedQuestion = /can they speak or cough|able to speak or cough|are they conscious|is the person conscious|responsive/.test(
    combinedContext,
  );

  const suggestsUnresponsive =
    /unresponsive|unconscious|not responding|passed out|collapsed|limp|no pulse|not breathing/.test(
      combinedContext,
    );
  const suggestsPartial =
    /can speak|able to speak|talking|coughing|cough forcefully|still coughing|breathing and coughing/.test(
      combinedContext,
    );
  const suggestsSevere =
    /cannot speak|can't speak|unable to speak|not able to speak|cannot cough|can't cough|silent|hands at throat|turning blue|blue lips|severe choking|airway blocked/.test(
      combinedContext,
    );

  const deterministicFallback = suggestsUnresponsive
    ? buildUnresponsiveResponse()
    : suggestsPartial
      ? buildConsciousPartialResponse()
      : suggestsSevere
        ? buildConsciousSevereResponse()
        : buildClarifyingQuestionResponse(alreadyAskedQuestion);

  const prompt = `
    You are an emergency medical assistant for choking emergencies ONLY.

    CURRENT CONTEXT: ${context}
    USER SAID: "${userSpeech}"

    HARD RULES:
    - Only address choking or airway obstruction.
    - Prioritize immediate physical actions over discussion.
    - Ask at most one short clarifying question only if absolutely necessary.
    - Never repeat the same question if it was already asked.
    - If choking is likely, give immediate steps instead of more questions.
    - Keep each step short and action-first.
    - Adult or older-child basic choking protocol only.
    - If unresponsive, switch to emergency services + CPR guidance.
    - Return valid JSON only.

    DECISION LOGIC:
    - If they can speak or cough forcefully: encourage coughing and monitor.
    - If they cannot speak/cough or are silent/blue: give back blows and abdominal thrusts.
    - If unresponsive: call emergency services, start CPR, check mouth only for visible object.
    - If truly unclear: ask one short question, ideally "Can they speak or cough?"

    Return JSON with:
    {
      "diagnosis": string,
      "severity": "low" | "medium" | "high" | "critical",
      "confidence": number,
      "steps": string[],
      "arPoints": [{ "x": number, "y": number, "label": string, "type": "action" | "warning" | "info" }],
      "warnings": string[],
      "nextQuestion": string optional,
      "arHumanAction": string optional,
      "phase": "question" | "action" | "unresponsive" optional,
      "hapticPattern": "cpr" | "pressure" | "steady" | "rhythmic_breathing" optional,
      "anatomyOverlay": "skeleton" | "circulatory" | "respiratory" | "nervous" optional
    }
  `;

  try {
    const response = await callGemini(ai, {
      model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: getImageData(frameImage),
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diagnosis: { type: Type.STRING },
            severity: {
              type: Type.STRING,
              enum: ["low", "medium", "high", "critical"],
            },
            confidence: { type: Type.NUMBER },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            arHumanAction: { type: Type.STRING },
            nextQuestion: { type: Type.STRING },
            phase: {
              type: Type.STRING,
              enum: ["question", "action", "unresponsive"],
            },
            hapticPattern: {
              type: Type.STRING,
              enum: ["cpr", "pressure", "steady", "rhythmic_breathing"],
            },
            anatomyOverlay: {
              type: Type.STRING,
              enum: ["skeleton", "circulatory", "respiratory", "nervous"],
            },
            arPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                  type: {
                    type: Type.STRING,
                    enum: ["action", "warning", "info"],
                  },
                },
                required: ["x", "y", "label", "type"],
              },
            },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            "diagnosis",
            "severity",
            "confidence",
            "steps",
            "arPoints",
            "warnings",
          ],
        },
      },
    });

    const raw = JSON.parse(response.text || "{}") as Partial<ChokingLiveResponse>;
    return sanitizeLiveResponse(raw, deterministicFallback, alreadyAskedQuestion);
  } catch (error) {
    console.error("Error analyzing choking live frame:", error);
    return deterministicFallback;
  }
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
  explanationPoints: {
    x: number;
    y: number;
    label: string;
    type: "error" | "success";
  }[];
}

export interface RadiologyResponse {
  specialty: "NEURO" | "CARDIO" | "ORTHO" | "ABDOMINAL" | "THORACIC";
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

export async function getRadiologyDeviceGuidance(
  scanType: string,
): Promise<{
  instructions: string[];
  safetyWarnings: string[];
  optimalSettings: string;
}> {
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
          optimalSettings: { type: Type.STRING },
        },
        required: ["instructions", "safetyWarnings", "optimalSettings"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function analyzeRadiology(
  image: string,
  context: string = "",
  isTraining: boolean = false,
): Promise<RadiologyResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
  const model = "gemini-3-flash-preview";

  const prompt = isTraining
    ? `
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
  `
    : `
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
          { inlineData: { mimeType: "image/jpeg", data: getImageData(image) } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          specialty: {
            type: Type.STRING,
            enum: ["NEURO", "CARDIO", "ORTHO", "ABDOMINAL", "THORACIC"],
          },
          findings: { type: Type.ARRAY, items: { type: Type.STRING } },
          diagnosis: { type: Type.STRING },
          differentialDiagnosis: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
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
                anatomicalLandmarks: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                deviceOperation: { type: Type.STRING },
              },
              required: ["step", "whatToLookFor", "anatomicalLandmarks"],
            },
          },
          arPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  enum: ["action", "warning", "info", "anatomy"],
                },
              },
              required: ["x", "y", "label", "type"],
            },
          },
          gradCamSimulatedHeatmap: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                intensity: { type: Type.NUMBER },
              },
              required: ["x", "y", "intensity"],
            },
          },
        },
        required: [
          "specialty",
          "findings",
          "diagnosis",
          "differentialDiagnosis",
          "treatmentPlan",
          "confidence",
          "trainingInstructions",
          "arPoints",
        ],
      },
    },
  });

  return JSON.parse(response.text || "{}");
}

export async function verifyStep(
  stepDescription: string,
  stepImage: string,
): Promise<VerificationResult> {
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
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: getImageData(stepImage),
            },
          },
        ],
      },
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
              coverageRatio: { type: Type.NUMBER },
            },
            required: [
              "distanceFromCenterMm",
              "angularDeviationDeg",
              "occlusionPercentage",
              "coverageRatio",
            ],
          },
          explanationPoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["error", "success"] },
              },
              required: ["x", "y", "label", "type"],
            },
          },
        },
        required: [
          "success",
          "feedback",
          "semanticScore",
          "geometricScore",
          "uncertainty",
          "metrics",
          "explanationPoints",
        ],
      },
    },
  });

  const raw = JSON.parse(response.text || "{}");

  // Research Algorithm: Final Confidence Calculation
  // Formula: w1(Semantic) + w2(Geometric) - w3(Uncertainty)
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;
  const finalConfidence =
    raw.semanticScore * w1 + raw.geometricScore * w2 - raw.uncertainty * w3;

  return {
    ...raw,
    finalConfidence: Math.max(0, Math.min(1, finalConfidence)),
  };
}