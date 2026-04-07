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

export type EmergencyType =
  | "unknown"
  | "choking"
  | "bleeding"
  | "burn"
  | "seizure"
  | "allergic_reaction"
  | "cardiac"
  | "stroke"
  | "breathing"
  | "unresponsive";

type LiveEmergencyResponse = FirstAidResponse & {
  emergencyType: EmergencyType;
  emergencyLabel: string;
  nextQuestion?: string;
  arHumanAction?: string;
  phase?: "question" | "action" | "unresponsive";
};

function buildConsciousSevereResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "choking",
    emergencyLabel: "Choking",
    diagnosis: "Severe choking suspected",
    severity: "critical",
    confidence: 92,
    phase: "action",
    steps: [
      "Stand behind them and lean them slightly forward.",
      "Give 5 hard back blows between the shoulder blades.",
      "If still blocked, give abdominal thrusts just above the navel with quick inward and upward thrusts.",
      "Repeat back blows and thrusts until the object comes out or they become unresponsive.",
    ],
    arHumanAction: "heimlich_pose",
    arPoints: [
      { x: 50, y: 34, label: "Back blows here", type: "action" },
      { x: 50, y: 57, label: "Abdominal thrust point", type: "action" },
      { x: 50, y: 20, label: "Watch airway and face color", type: "warning" },
    ],
    warnings: [
      "Do not do blind finger sweeps.",
      "If they turn blue, cannot breathe, or do not improve quickly, call emergency services.",
      "If the person becomes limp or unresponsive, start CPR immediately.",
    ],
    hapticPattern: "pressure",
    anatomyOverlay: "respiratory",
  };
}

function buildConsciousPartialResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "choking",
    emergencyLabel: "Choking",
    diagnosis: "Partial airway blockage possible",
    severity: "high",
    confidence: 86,
    phase: "action",
    steps: [
      "Tell them to keep coughing forcefully.",
      "Stay with them and watch for worsening breathing or silence.",
      "Call emergency services now if they cannot clear it quickly or start struggling to speak.",
    ],
    arHumanAction: "pressure_pose",
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

function buildUnresponsiveResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "choking",
    emergencyLabel: "Choking",
    diagnosis: "Choking emergency with unresponsiveness",
    severity: "critical",
    confidence: 96,
    phase: "unresponsive",
    steps: [
      "Call emergency services now and get an AED if available.",
      "Place the heel of your hand in the center of the chest and push hard and fast at about 100 to 120 compressions per minute.",
      "After 30 compressions, open the mouth and remove an object only if you can clearly see it.",
      "If trained, give 2 rescue breaths, then keep doing cycles of compressions and mouth checks until help takes over.",
    ],
    arHumanAction: "cpr_pose",
    arPoints: [
      {
        x: 50,
        y: 42,
        label: "Center of chest for compressions",
        type: "action",
      },
      {
        x: 50,
        y: 18,
        label: "Check mouth only for visible object",
        type: "warning",
      },
    ],
    warnings: [
      "Do not do blind finger sweeps.",
      "If not breathing normally, continue CPR until emergency responders arrive.",
    ],
    hapticPattern: "cpr",
    anatomyOverlay: "respiratory",
  };
}

function buildClarifyingQuestionResponse(
  alreadyAsked: boolean,
): LiveEmergencyResponse {
  return {
    emergencyType: "choking",
    emergencyLabel: "Choking",
    diagnosis: "Possible choking emergency",
    severity: "high",
    confidence: 68,
    phase: alreadyAsked ? "action" : "question",
    steps: alreadyAsked
      ? [
          "If they cannot speak, breathe, or cough forcefully, start 5 back blows now.",
          "Then give abdominal thrusts and repeat until the object clears or they become unresponsive.",
        ]
      : [
          "Stay calm and be ready to act.",
          "First, I need to know: can they speak and are they able to cough forcefully?",
        ],
    arHumanAction: alreadyAsked ? "heimlich_pose" : "pressure_pose",
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

function buildUnknownEmergencyResponse(
  alreadyAsked: boolean,
): LiveEmergencyResponse {
  return {
    emergencyType: "unknown",
    emergencyLabel: "Emergency Intake",
    diagnosis: "Emergency type not clear yet",
    severity: "medium",
    confidence: 60,
    phase: "question",
    steps: alreadyAsked
      ? [
          "Tell me the main problem in a few words.",
          "Examples: choking, heavy bleeding, burn, seizure, allergic reaction, chest pain, stroke, trouble breathing, or unresponsive person.",
        ]
      : [
          "Tell me what is happening right now.",
          "I can guide choking, bleeding, burns, seizures, allergic reactions, chest pain, stroke, breathing trouble, and unresponsive patients.",
        ],
    arPoints: [{ x: 50, y: 24, label: "Describe the emergency", type: "info" }],
    warnings: [
      "If the person is unconscious or not breathing normally, call emergency services now.",
    ],
    nextQuestion: alreadyAsked
      ? "What is the main emergency?"
      : "What is the main emergency right now?",
    hapticPattern: "steady",
    anatomyOverlay: "respiratory",
  };
}

function buildBleedingResponse(combinedContext: string): LiveEmergencyResponse {
  const severeBleeding =
    /heavy bleeding|severe bleeding|spurting|gushing|pooling blood|won't stop|wont stop|soaked through|amputation|blood everywhere/.test(
      combinedContext,
    );

  return {
    emergencyType: "bleeding",
    emergencyLabel: "Bleeding",
    diagnosis: severeBleeding
      ? "Severe bleeding suspected"
      : "Bleeding injury suspected",
    severity: severeBleeding ? "critical" : "high",
    confidence: severeBleeding ? 92 : 84,
    phase: "action",
    steps: severeBleeding
      ? [
          "Put firm direct pressure on the bleeding area with a clean cloth or your gloved hand.",
          "If blood soaks through, add more cloth on top and keep pressing without removing the first layer.",
          "If possible, raise the injured area and keep them lying down and warm.",
          "Call emergency services now if the bleeding is heavy or not stopping.",
        ]
      : [
          "Apply direct pressure until the bleeding stops.",
          "Once controlled, rinse the wound gently with clean water.",
          "Cover it with a clean bandage.",
          "Seek urgent care if the wound is deep, dirty, or starts bleeding again.",
        ],
    arHumanAction: "pressure_pose",
    arPoints: [
      { x: 50, y: 50, label: "Press directly here", type: "action" },
      { x: 50, y: 24, label: "Watch for shock", type: "warning" },
    ],
    warnings: [
      "Do not keep lifting the cloth to check the wound.",
      "If they become pale, weak, confused, or faint, treat it as life-threatening.",
    ],
    hapticPattern: "pressure",
    anatomyOverlay: "circulatory",
  };
}

function buildBurnResponse(combinedContext: string): LiveEmergencyResponse {
  const severeBurn =
    /chemical burn|electrical burn|face burn|airway burn|large burn|deep burn|charred|blistering badly/.test(
      combinedContext,
    );

  return {
    emergencyType: "burn",
    emergencyLabel: "Burn",
    diagnosis: severeBurn ? "Serious burn suspected" : "Burn injury suspected",
    severity: severeBurn ? "critical" : "high",
    confidence: severeBurn ? 90 : 82,
    phase: "action",
    steps: [
      "Move them away from the heat, electricity, or chemical source.",
      "Cool the burn under cool running water for 20 minutes. Do not use ice.",
      "Remove rings, watches, or tight clothing before swelling starts if they are not stuck to the skin.",
      "Cover the burn loosely with a clean non-stick cloth or dressing.",
    ],
    arPoints: [
      { x: 50, y: 50, label: "Cool the burned area", type: "action" },
      { x: 50, y: 24, label: "Watch airway and face burns", type: "warning" },
    ],
    warnings: [
      "Do not pop blisters or apply butter, oils, or toothpaste.",
      "Call emergency services for electrical, chemical, facial, airway, or large burns.",
    ],
    hapticPattern: "steady",
    anatomyOverlay: "nervous",
  };
}

function buildSeizureResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "seizure",
    emergencyLabel: "Seizure",
    diagnosis: "Seizure suspected",
    severity: "critical",
    confidence: 90,
    phase: "action",
    steps: [
      "Move hard or sharp objects away and protect the head with something soft.",
      "Do not hold them down and do not put anything in their mouth.",
      "Time the seizure.",
      "When the shaking stops, roll them onto their side and watch breathing.",
    ],
    arHumanAction: "recovery_position",
    arPoints: [
      { x: 50, y: 20, label: "Protect the head", type: "action" },
      { x: 50, y: 55, label: "Recovery position after shaking stops", type: "action" },
    ],
    warnings: [
      "Call emergency services if the seizure lasts more than 5 minutes, repeats, or this is their first seizure.",
      "If they stop breathing normally after the seizure, start CPR.",
    ],
    hapticPattern: "steady",
    anatomyOverlay: "nervous",
  };
}

function buildAllergicReactionResponse(
  combinedContext: string,
): LiveEmergencyResponse {
  const severeReaction =
    /anaphylaxis|epi|epipen|swelling lips|swelling tongue|swollen tongue|throat swelling|wheezing|hives everywhere|trouble breathing/.test(
      combinedContext,
    );

  return {
    emergencyType: "allergic_reaction",
    emergencyLabel: "Allergic Reaction",
    diagnosis: severeReaction
      ? "Severe allergic reaction suspected"
      : "Allergic reaction suspected",
    severity: severeReaction ? "critical" : "high",
    confidence: severeReaction ? 93 : 82,
    phase: "action",
    steps: severeReaction
      ? [
          "Use their epinephrine auto-injector now if one is available.",
          "Call emergency services immediately.",
          "Lay them flat with legs raised unless they are vomiting or struggling to breathe.",
          "If symptoms continue and a second injector is available, be ready to use it after 5 to 15 minutes.",
        ]
      : [
          "Move them away from the suspected trigger if possible.",
          "Watch closely for swelling, wheezing, or trouble breathing.",
          "Use prescribed allergy medicine if they have one and can swallow safely.",
          "Call emergency services if breathing trouble, facial swelling, or widespread hives start.",
        ],
    arPoints: [
      { x: 50, y: 18, label: "Watch lips and tongue swelling", type: "warning" },
      { x: 50, y: 32, label: "Watch breathing closely", type: "warning" },
    ],
    warnings: [
      "Do not wait if they have throat tightness, wheezing, or faintness.",
      "Be ready for CPR if they become unresponsive.",
    ],
    hapticPattern: severeReaction ? "pressure" : "steady",
    anatomyOverlay: "respiratory",
  };
}

function buildCardiacResponse(combinedContext: string): LiveEmergencyResponse {
  const collapsed =
    /collapsed|unresponsive|not breathing|no pulse/.test(combinedContext);

  if (collapsed) {
    return buildUnresponsiveMedicalResponse();
  }

  return {
    emergencyType: "cardiac",
    emergencyLabel: "Chest Pain",
    diagnosis: "Possible heart attack or cardiac emergency",
    severity: "critical",
    confidence: 88,
    phase: "action",
    steps: [
      "Call emergency services now.",
      "Have them sit down and rest with tight clothing loosened.",
      "If they are awake, can swallow, and are not allergic, have them chew one adult aspirin.",
      "Be ready to start CPR and use an AED if they collapse.",
    ],
    arPoints: [
      { x: 50, y: 40, label: "Chest pain area", type: "warning" },
      { x: 50, y: 18, label: "Watch breathing and alertness", type: "warning" },
    ],
    warnings: [
      "Do not let them walk around or drive themselves.",
      "If they become unresponsive or stop breathing normally, start CPR immediately.",
    ],
    hapticPattern: "steady",
    anatomyOverlay: "circulatory",
  };
}

function buildStrokeResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "stroke",
    emergencyLabel: "Stroke",
    diagnosis: "Possible stroke suspected",
    severity: "critical",
    confidence: 90,
    phase: "action",
    steps: [
      "Call emergency services immediately and say stroke is suspected.",
      "Note the exact time symptoms started or when they were last known normal.",
      "Keep them sitting up slightly with the airway clear.",
      "Do not give food, drink, or medicine unless emergency services instruct you to.",
    ],
    arPoints: [
      { x: 40, y: 20, label: "Check face droop", type: "warning" },
      { x: 50, y: 32, label: "Listen for slurred speech", type: "warning" },
    ],
    warnings: [
      "Watch for face droop, arm weakness, or speech changes.",
      "If they become unresponsive, switch to CPR guidance.",
    ],
    hapticPattern: "steady",
    anatomyOverlay: "nervous",
  };
}

function buildBreathingEmergencyResponse(
  combinedContext: string,
): LiveEmergencyResponse {
  const severeDistress =
    /blue lips|cannot speak full sentences|gasping|very short of breath|severe asthma|inhaler not helping/.test(
      combinedContext,
    );

  return {
    emergencyType: "breathing",
    emergencyLabel: "Breathing Trouble",
    diagnosis: severeDistress
      ? "Severe breathing emergency suspected"
      : "Breathing difficulty suspected",
    severity: severeDistress ? "critical" : "high",
    confidence: severeDistress ? 90 : 82,
    phase: "action",
    steps: [
      "Sit them upright and help them stay calm.",
      "Help them use their prescribed rescue inhaler if they have one.",
      "Loosen tight clothing and keep the airway clear.",
      "Call emergency services if they are getting worse, turning blue, or struggling to speak.",
    ],
    arPoints: [
      { x: 50, y: 28, label: "Watch chest rise", type: "warning" },
      { x: 50, y: 18, label: "Watch lips and face color", type: "warning" },
    ],
    warnings: [
      "If they become unresponsive or stop breathing normally, start CPR.",
      "Do not force them to lie flat if breathing is harder that way.",
    ],
    hapticPattern: "rhythmic_breathing",
    anatomyOverlay: "respiratory",
  };
}

function buildUnresponsiveMedicalResponse(): LiveEmergencyResponse {
  return {
    emergencyType: "unresponsive",
    emergencyLabel: "Unresponsive",
    diagnosis: "Unresponsive patient with possible cardiac arrest",
    severity: "critical",
    confidence: 95,
    phase: "unresponsive",
    steps: [
      "Call emergency services now and get an AED if available.",
      "Start CPR in the center of the chest at 100 to 120 compressions per minute.",
      "Use the AED as soon as it arrives and follow its prompts.",
      "Keep doing CPR until the person starts breathing normally or help takes over.",
    ],
    arHumanAction: "cpr_pose",
    arPoints: [
      { x: 50, y: 42, label: "Chest compression point", type: "action" },
      { x: 50, y: 18, label: "Watch airway and breathing", type: "warning" },
    ],
    warnings: [
      "Push hard and fast and let the chest fully rise between compressions.",
      "If you are trained, give rescue breaths after every 30 compressions.",
    ],
    hapticPattern: "cpr",
    anatomyOverlay: "circulatory",
  };
}

function detectEmergencyType(combinedContext: string): EmergencyType {
  if (
    /chok|food stuck|something stuck|hands at throat|cannot speak|can't speak|cannot cough|can't cough|airway blocked/.test(
      combinedContext,
    )
  ) {
    return "choking";
  }

  if (
    /anaphylaxis|allergic|epipen|epi pen|hives|swollen lips|swelling lips|swelling tongue|bee sting allergy/.test(
      combinedContext,
    )
  ) {
    return "allergic_reaction";
  }

  if (/seizure|convulsion|shaking uncontrollably|fits/.test(combinedContext)) {
    return "seizure";
  }

  if (/face droop|slurred speech|one arm weak|stroke|fast test/.test(combinedContext)) {
    return "stroke";
  }

  if (
    /chest pain|heart attack|pressure in chest|pain in jaw|pain in left arm|cardiac/.test(
      combinedContext,
    )
  ) {
    return "cardiac";
  }

  if (
    /bleeding|blood everywhere|cut badly|wound bleeding|spurting blood|gushing blood|hemorrhage/.test(
      combinedContext,
    )
  ) {
    return "bleeding";
  }

  if (/burn|scald|chemical burn|electrical burn|on fire|hot oil/.test(combinedContext)) {
    return "burn";
  }

  if (
    /asthma|wheezing|short of breath|shortness of breath|trouble breathing|difficulty breathing/.test(
      combinedContext,
    )
  ) {
    return "breathing";
  }

  if (
    /unresponsive|unconscious|not responding|collapsed|no pulse|not breathing/.test(
      combinedContext,
    )
  ) {
    return "unresponsive";
  }

  return "unknown";
}

function selectDeterministicChokingResponse(
  combinedContext: string,
  alreadyAskedQuestion: boolean,
): LiveEmergencyResponse {
  const mentionsChoking =
    /chok|airway|something stuck|food stuck|can't breathe|cannot breathe|not breathing right|throat/.test(
      combinedContext,
    );
  const suggestsUnresponsive =
    /unresponsive|unconscious|not responding|passed out|collapsed|limp|no pulse|not breathing/.test(
      combinedContext,
    );
  const suggestsPartial =
    /can speak|able to speak|talking|coughing|cough forcefully|still coughing|breathing and coughing|making sound/.test(
      combinedContext,
    );
  const suggestsSevere =
    /cannot speak|can't speak|unable to speak|not able to speak|cannot cough|can't cough|silent|hands at throat|turning blue|blue lips|severe choking|airway blocked|gasping/.test(
      combinedContext,
    );

  if (suggestsUnresponsive) {
    return buildUnresponsiveResponse();
  }

  if (suggestsPartial) {
    return buildConsciousPartialResponse();
  }

  if (suggestsSevere || mentionsChoking || alreadyAskedQuestion) {
    return buildConsciousSevereResponse();
  }

  return buildClarifyingQuestionResponse(alreadyAskedQuestion);
}

function sanitizeLiveResponse(
  raw: Partial<LiveEmergencyResponse>,
  fallback: LiveEmergencyResponse,
  alreadyAskedQuestion: boolean,
): LiveEmergencyResponse {
  const nextQuestion = raw.nextQuestion?.trim();
  const shouldSuppressQuestion =
    alreadyAskedQuestion &&
    !!nextQuestion &&
    /speak|cough|conscious|responsive|breathing/.test(
      normalizeText(nextQuestion),
    );

  return {
    emergencyType: raw.emergencyType || fallback.emergencyType,
    emergencyLabel: raw.emergencyLabel || fallback.emergencyLabel,
    diagnosis: raw.diagnosis || fallback.diagnosis,
    severity:
      raw.severity &&
      ["low", "medium", "high", "critical"].includes(raw.severity)
        ? raw.severity
        : fallback.severity,
    confidence:
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(100, raw.confidence))
        : fallback.confidence,
    phase:
      raw.phase === "question" ||
      raw.phase === "action" ||
      raw.phase === "unresponsive"
        ? raw.phase
        : fallback.phase,
    steps: uniqueSteps(
      Array.isArray(raw.steps) && raw.steps.length > 0
        ? raw.steps.slice(0, 4)
        : fallback.steps,
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
  _frameImage: string,
  context: string = "",
  userSpeech: string = "",
): Promise<
  FirstAidResponse & {
    emergencyType?: EmergencyType;
    emergencyLabel?: string;
    nextQuestion?: string;
    arHumanAction?: string;
    phase?: string;
  }
> {
  const combinedContext = normalizeText(`${context} ${userSpeech}`);
  const alreadyAskedQuestion =
    /can they speak or cough|able to speak or cough|are they conscious|is the person conscious|responsive/.test(
      combinedContext,
    );

  let response: LiveEmergencyResponse;
  switch (detectEmergencyType(combinedContext)) {
    case "choking":
      response = selectDeterministicChokingResponse(
        combinedContext,
        alreadyAskedQuestion,
      );
      break;
    case "bleeding":
      response = buildBleedingResponse(combinedContext);
      break;
    case "burn":
      response = buildBurnResponse(combinedContext);
      break;
    case "seizure":
      response = buildSeizureResponse();
      break;
    case "allergic_reaction":
      response = buildAllergicReactionResponse(combinedContext);
      break;
    case "cardiac":
      response = buildCardiacResponse(combinedContext);
      break;
    case "stroke":
      response = buildStrokeResponse();
      break;
    case "breathing":
      response = buildBreathingEmergencyResponse(combinedContext);
      break;
    case "unresponsive":
      response = buildUnresponsiveMedicalResponse();
      break;
    default:
      response = buildUnknownEmergencyResponse(alreadyAskedQuestion);
      break;
  }

  return sanitizeLiveResponse(response, response, alreadyAskedQuestion);
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

export async function getRadiologyDeviceGuidance(scanType: string): Promise<{
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
