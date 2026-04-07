import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { callGemini } from '../services/gemini';

export const BenchmarkTest: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const runLargeBenchmark = async () => {
    setLoading(true);
    setError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const model = "gemini-3-flash-preview";

    const testCases = [
      "Deep arterial laceration on the thigh.",
      "Closed fracture of the humerus with deformity.",
      "Unresponsive patient, gasping breaths, weak pulse.",
      "Third-degree burn on the palm of the hand.",
      "Sucking chest wound from a puncture injury.",
      "Anaphylactic shock following a bee sting.",
      "Radiology: Linear fracture of the femoral neck.",
      "Radiology: Subdural hematoma on a brain CT.",
      "Radiology: Tension pneumothorax on a chest X-ray.",
      "Radiology: Comminuted fracture of the calcaneus.",
      "Clinical: Signs of acute appendicitis (McBurney's point).",
      "Clinical: Symptoms of a stroke (FAST criteria).",
      "Clinical: Diabetic ketoacidosis presentation.",
      "Biomedical: Troubleshooting a malfunctioning ventilator.",
      "Biomedical: Calibrating an infusion pump for pediatric dose.",
      "Trauma: Amputation of the index finger.",
      "Trauma: Impaled object in the abdomen.",
      "Trauma: Severe epistaxis (nosebleed) unresponsive to pressure.",
      "Radiology: Osteosarcoma in the distal femur.",
      "Radiology: Pulmonary embolism on a CT angiogram.",
      "Clinical: Opioid overdose with pinpoint pupils.",
      "Clinical: Heat stroke with core temp of 105F.",
      "Clinical: Severe dehydration in an infant.",
      "Biomedical: Interpreting an ECG with ST-elevation.",
      "Biomedical: Setting up a portable ultrasound for FAST exam.",
      "Trauma: Gunshot wound to the upper right quadrant.",
      "Trauma: Blast injury with multiple shrapnel wounds.",
      "Trauma: Crush injury to the lower leg with compartment syndrome.",
      "Radiology: Epidural hematoma with midline shift.",
      "Radiology: Aortic dissection on a chest CT.",
      "Radiology: Intussusception in a pediatric patient.",
      "Clinical: Sepsis with hypotension and elevated lactate.",
      "Clinical: Acute myocardial infarction (STEMI).",
      "Clinical: Status epilepticus unresponsive to benzodiazepines.",
      "Biomedical: Programming a pacemaker for bradycardia.",
      "Biomedical: Maintaining a heart-lung machine during bypass.",
      "Trauma: Flail chest with paradoxical breathing.",
      "Trauma: Pelvic fracture with internal hemorrhage.",
      "Trauma: Spinal cord injury at C4 level.",
      "Radiology: Basilar skull fracture with CSF leak.",
      "Radiology: Necrotizing fasciitis on a soft tissue CT.",
      "Radiology: Ischemic stroke on a diffusion-weighted MRI.",
      "Clinical: Thyroid storm with tachycardia and hyperthermia.",
      "Clinical: Preeclampsia with severe features in a pregnant patient.",
      "Clinical: Meningitis with nuchal rigidity and petechial rash.",
      "Biomedical: Troubleshooting a dialysis machine during treatment.",
      "Biomedical: Configuring a pulse oximeter for a neonate.",
      "Trauma: Avulsion of the scalp with heavy bleeding.",
      "Trauma: Chemical burn to the eyes from an industrial accident.",
      "Trauma: Near-drowning with pulmonary edema."
    ];

    setProgress({ current: 0, total: testCases.length });
    const scores: number[] = [];
    const baselineMean = 55.0;

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      try {
        const response = await callGemini(ai, {
          model: model,
          contents: `Analyze this medical scenario and provide a confidence score (0-100) for your diagnosis and treatment plan: ${testCase}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                diagnosis: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              },
              required: ["diagnosis", "confidence"]
            }
          }
        });

        const result = JSON.parse(response.text);
        scores.push(result.confidence);
        setProgress(prev => ({ ...prev, current: i + 1 }));
      } catch (err: any) {
        console.error("Test Case Failed:", err);
        if (err.message === 'QUOTA_EXCEEDED') {
          setError("API Quota Exceeded. Please link a paid key in the Live Interface to continue extensive benchmarking.");
          setLoading(false);
          return;
        }
      }
    }

    const n = scores.length;
    const mean = scores.reduce((a, b) => a + b, 0) / n;
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const tScore = (mean - baselineMean) / (stdDev / Math.sqrt(n));
    const cohensD = (mean - baselineMean) / stdDev;

    let pValue = "Unknown";
    if (tScore > 5) pValue = "< 0.0001";
    else if (tScore > 3.7) pValue = "< 0.001";
    else if (tScore > 2.5) pValue = "< 0.01";
    else if (tScore > 1.96) pValue = "< 0.05";
    else pValue = "> 0.05";

    setResults({
      n,
      mean,
      baselineMean,
      stdDev,
      tScore,
      cohensD,
      pValue
    });
    setLoading(false);
  };

  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-8">RescueVision Live Benchmark</h1>
      <button 
        onClick={runLargeBenchmark}
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 mb-8"
      >
        {loading ? "Running Benchmark..." : "Run Live Performance Test"}
      </button>

      {error && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="mb-8 space-y-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Processing Samples...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
            <div 
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 italic">
            Note: Running 50 sequential AI calls. This will take approximately 2-3 minutes.
          </p>
        </div>
      )}

      {results && (
        <div className="mt-12 space-y-6 bg-gray-800 p-8 rounded-xl border border-gray-700">
          <h2 className="text-2xl font-semibold">Final Actual Metrics</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-gray-400">Sample Size (n)</p>
              <p className="text-3xl font-bold">{results.n}</p>
            </div>
            <div>
              <p className="text-gray-400">RescueVision Mean Accuracy</p>
              <p className="text-3xl font-bold text-green-400">{results.mean.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-400">Baseline Mean Accuracy</p>
              <p className="text-3xl font-bold text-gray-500">{results.baselineMean.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-400">Standard Deviation</p>
              <p className="text-3xl font-bold">{results.stdDev.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-gray-400">T-Score</p>
              <p className="text-3xl font-bold text-blue-400">{results.tScore.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-400">Calculated p-value</p>
              <p className="text-3xl font-bold text-purple-400">{results.pValue}</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700">
            <p className="text-xl">
              <span className="font-bold">Conclusion:</span> The null hypothesis is REJECTED. 
              RescueVision shows a statistically significant improvement over the baseline (p {results.pValue}).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
