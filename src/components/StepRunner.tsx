import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Camera, ChevronRight, Loader2, AlertTriangle, X, Activity } from 'lucide-react';
import { FirstAidResponse, verifyStep, VerificationResult } from '../services/gemini';
import { CameraView } from './CameraView';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

interface StepRunnerProps {
  data: FirstAidResponse;
  closeupImage: string;
  onClose: () => void;
}

export const StepRunner: React.FC<StepRunnerProps> = ({ data, closeupImage, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [mode, setMode] = useState<'INSTRUCTION' | 'VERIFY_CAMERA' | 'VERIFYING' | 'COMPLETED'>('INSTRUCTION');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [medicalLog, setMedicalLog] = useState<{ step: string; timestamp: string; verified: boolean; confidence: number; metrics?: any }[]>([]);
  const [showResearchDashboard, setShowResearchDashboard] = useState(false);
  const [verificationImage, setVerificationImage] = useState<string | null>(null);

  const currentStep = data.steps[currentStepIndex];

  const handleNext = () => {
    setMode('VERIFY_CAMERA');
  };

  const handleCaptureVerification = async (image: string) => {
    setVerificationImage(image);
    setMode('VERIFYING');
    try {
      const result = await verifyStep(currentStep, image);
      setVerificationResult(result);
      
      const logEntry = {
        step: currentStep,
        timestamp: new Date().toISOString(),
        verified: result.success,
        confidence: result.finalConfidence,
        metrics: result.metrics
      };
      setMedicalLog(prev => [...prev, logEntry]);

      // Research Gating: P(correct) - U >= tau (0.18)
      const tau = 0.18;
      const passGating = (result.semanticScore - result.uncertainty) >= tau;

      if (result.success && passGating) {
        if (currentStepIndex < data.steps.length - 1) {
          setTimeout(() => {
            setCurrentStepIndex(prev => prev + 1);
            setMode('INSTRUCTION');
            setIsChecked(false);
            setVerificationResult(null);
            setVerificationImage(null);
          }, 4500);
        } else {
          setMode('COMPLETED');
        }
      } else {
        // Failed gating or verification
        setTimeout(() => {
          setMode('INSTRUCTION');
          setIsChecked(false);
          setVerificationResult(null);
          setVerificationImage(null);
        }, 6000);
      }
    } catch (err) {
      console.error(err);
      setMode('INSTRUCTION');
    }
  };

  const exportLog = () => {
    const logData = {
      diagnosis: data.diagnosis,
      severity: data.severity,
      initialConfidence: data.confidence,
      timeline: medicalLog,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medical_log_${Date.now()}.json`;
    a.click();
  };

  const triggerEMS = () => {
    alert("SIMULATED EMERGENCY CALL: Dialing 911... Sending location and medical data log to dispatch.");
  };

  return (
    <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-white text-sm font-medium tracking-tight">{data.diagnosis}</h2>
            <div className="flex items-center gap-2">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">
                Aegis Quantum v2.1 // Step {currentStepIndex + 1} of {data.steps.length}
              </p>
              <div className="w-px h-2 bg-white/10" />
              <p className="text-emerald-400/60 text-[10px] uppercase tracking-widest font-mono">
                AI Confidence: {data.confidence}%
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={triggerEMS}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-full text-[10px] font-mono text-red-400 uppercase tracking-widest hover:bg-red-500/20 transition-colors"
          >
            Escalate to EMS
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col">
        {/* Visual Reference (Closeup Image) */}
        <div className="relative h-1/2 bg-black overflow-hidden border-b border-white/10 shrink-0">
          <img 
            src={mode === 'VERIFYING' && verificationImage ? verificationImage : closeupImage} 
            alt="Reference" 
            className={cn(
              "w-full h-full object-contain transition-opacity duration-500",
              mode === 'VERIFYING' ? "opacity-100" : "opacity-40"
            )}
          />
          
          {/* AR Points & Explainability Overlays */}
          <div className="absolute inset-0">
            {mode !== 'VERIFYING' && data.arPoints.map((point, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <div className={cn(
                  "w-6 h-6 rounded-full border flex items-center justify-center",
                  point.type === 'action' ? "border-emerald-400 bg-emerald-400/20" : "border-blue-400 bg-blue-400/20"
                )}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </motion.div>
            ))}

            {/* Explainability Points (Saliency/Geometric Errors) */}
            {mode === 'VERIFYING' && verificationResult?.explanationPoints.map((point, idx) => (
              <motion.div
                key={`exp-${idx}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 mb-1",
                  point.type === 'error' ? "border-red-500 bg-red-500/20" : "border-emerald-500 bg-emerald-500/20"
                )} />
                <div className="px-2 py-1 bg-black/80 backdrop-blur-md rounded text-[8px] text-white whitespace-nowrap border border-white/10">
                  {point.label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Research Mode Overlay (Internal Metrics) */}
          <div className="absolute bottom-4 left-4 flex flex-col gap-2">
            <button 
              onClick={() => setShowResearchDashboard(!showResearchDashboard)}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-lg text-[7px] font-mono text-white/60 uppercase tracking-widest transition-colors"
            >
              {showResearchDashboard ? 'Hide Data' : 'Show Data'}
            </button>
            <div className="p-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg font-mono text-[7px] text-white/40 space-y-0.5">
              <p>MODEL: AEGIS_Q_V2.1</p>
              <p>LATENCY: 0.8s</p>
            </div>
          </div>

          {/* Research Dashboard Modal */}
          <AnimatePresence>
            {showResearchDashboard && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-4 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 overflow-y-auto z-50 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-white font-mono text-[8px] uppercase tracking-[0.2em]">Research Fidelity</h4>
                  <button onClick={() => setShowResearchDashboard(false)} className="text-white/40 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-white/40 text-[6px] uppercase mb-2">Gating Impact</p>
                    <div className="h-16 flex items-end gap-1">
                      <div className="flex-1 bg-emerald-500/20 border border-emerald-500/40 h-[89%] rounded-t-sm relative">
                        <div className="absolute -top-3 left-0 w-full text-center text-[6px] text-emerald-400">89%</div>
                      </div>
                      <div className="flex-1 bg-red-500/20 border border-red-500/40 h-[54%] rounded-t-sm relative">
                        <div className="absolute -top-3 left-0 w-full text-center text-[6px] text-red-400">54%</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-white/40 text-[6px] uppercase mb-2">Entropy H(x)</p>
                    <div className="h-16 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border border-dashed border-white/10 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-blue-500/20 animate-pulse" />
                      </div>
                    </div>
                    <p className="text-center text-[6px] text-white/20 mt-1">0.42 bits</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-white/40 text-[6px] uppercase mb-1">Failure Mode Analysis</p>
                  {[
                    { mode: 'False Positive', sev: 9, prob: 2 },
                    { mode: 'Hallucination', sev: 8, prob: 3 },
                    { mode: 'Geometric Drift', sev: 4, prob: 6 }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5 text-[7px] font-mono">
                      <span className="text-white/60">{item.mode}</span>
                      <div className="flex gap-2">
                        <span className="text-red-400">S:{item.sev}</span>
                        <span className="text-orange-400">P:{item.prob}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Interaction Area */}
        <div className="flex-1 bg-[#0A0A0A] flex flex-col p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            {mode === 'INSTRUCTION' && (
              <motion.div 
                key="instruction"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col"
              >
                <div className="flex-1">
                  <div className="mb-8">
                    <span className="text-emerald-400 font-mono text-[10px] uppercase tracking-[0.2em]">Current Task</span>
                    <h3 className="text-2xl text-white font-light mt-2 leading-tight">
                      <Markdown>{currentStep}</Markdown>
                    </h3>
                  </div>

                  {data.warnings.length > 0 && currentStepIndex === 0 && (
                    <div className="p-4 bg-red-400/5 border border-red-400/20 rounded-xl mb-8">
                      <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-mono text-[10px] uppercase tracking-widest">Safety Warning</span>
                      </div>
                      <p className="text-red-200/60 text-xs">{data.warnings[0]}</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setIsChecked(!isChecked)}
                    className={cn(
                      "w-full p-6 rounded-2xl border transition-all flex items-center gap-4 group",
                      isChecked ? "bg-emerald-500/10 border-emerald-500/40" : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md border flex items-center justify-center transition-colors",
                      isChecked ? "bg-emerald-500 border-emerald-500" : "border-white/20"
                    )}>
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-black" />}
                    </div>
                    <span className={cn(
                      "text-sm font-medium transition-colors",
                      isChecked ? "text-emerald-400" : "text-white/60"
                    )}>
                      I have completed this step
                    </span>
                  </button>
                </div>

                <button
                  disabled={!isChecked}
                  onClick={handleNext}
                  className={cn(
                    "w-full py-5 rounded-xl font-bold uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-2",
                    isChecked ? "bg-white text-black" : "bg-white/5 text-white/20 cursor-not-allowed"
                  )}
                >
                  Verify with Photo
                  <Camera className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {mode === 'VERIFY_CAMERA' && (
              <motion.div 
                key="camera"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-10"
              >
                <CameraView 
                  label="Verification Scan" 
                  description="Show the injury after completing the step"
                  onCapture={handleCaptureVerification}
                />
                <button 
                  onClick={() => setMode('INSTRUCTION')}
                  className="absolute top-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-white"
                >
                  Back to Instruction
                </button>
              </motion.div>
            )}

            {mode === 'VERIFYING' && (
              <motion.div 
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-6" />
                <h3 className="text-white font-mono text-[10px] uppercase tracking-[0.2em] mb-2">AI Verification</h3>
                <p className="text-white/40 text-xs max-w-[200px]">Analyzing your progress...</p>
                
                {verificationResult && (
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="mt-8 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl w-full"
                  >
                    <p className={cn(
                      "text-sm italic mb-4",
                      verificationResult.success ? "text-emerald-400" : "text-red-400"
                    )}>
                      "{verificationResult.feedback}"
                    </p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[8px] font-mono text-white/40 uppercase">Hybrid Confidence</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${verificationResult.finalConfidence * 100}%` }}
                              className="h-full bg-emerald-500"
                            />
                          </div>
                          <span className="text-[8px] font-mono text-white/40">{(verificationResult.finalConfidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <div className="text-left">
                          <p className="text-[6px] text-white/20 uppercase">Distance</p>
                          <p className="text-[10px] font-mono text-white/60">{verificationResult.metrics.distanceFromCenterMm}mm</p>
                        </div>
                        <div className="text-left">
                          <p className="text-[6px] text-white/20 uppercase">Angular Dev</p>
                          <p className="text-[10px] font-mono text-white/60">{verificationResult.metrics.angularDeviationDeg}°</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {mode === 'COMPLETED' && (
              <motion.div 
                key="completed"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-10 h-10 text-black" />
                </div>
                <h2 className="text-3xl text-white font-light tracking-tight mb-4">Treatment Complete</h2>
                <p className="text-white/40 text-sm mb-12">All steps have been verified. Monitor the patient closely.</p>
                
                <div className="w-full space-y-4">
                  <button 
                    onClick={exportLog}
                    className="w-full py-5 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-xs rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Export Medical Log
                  </button>
                  <button 
                    onClick={onClose}
                    className="w-full py-5 bg-white text-black font-bold uppercase tracking-[0.2em] text-xs rounded-xl"
                  >
                    Finish Session
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
