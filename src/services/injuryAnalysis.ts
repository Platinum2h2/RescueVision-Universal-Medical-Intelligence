import { GoogleGenAI, Type } from "@google/genai";
import { callGemini, FirstAidResponse } from "./gemini";

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
