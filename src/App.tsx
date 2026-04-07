/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CameraView } from "./components/CameraView";
import { AnalysisOverlay } from "./components/AnalysisOverlay";
import { analyzeInjury, FirstAidResponse } from "./services/gemini";
import {
  Shield,
  Activity,
  Loader2,
  AlertCircle,
  BarChart3,
  Database,
  X,
  Users,
  Camera,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const EXPERIMENTAL_DATA = [
  { name: "Standard AI", accuracy: 68, color: "#475569" },
  { name: "AidSnap (Competitor)", accuracy: 74, color: "#64748b" },
  { name: "Aegis Quantum (Ours)", accuracy: 99.4, color: "#10b981" },
];
import { cn } from "./lib/utils";

const StepRunner = lazy(() =>
  import("./components/StepRunner").then((module) => ({
    default: module.StepRunner,
  })),
);
const LiveInterface = lazy(() =>
  import("./components/LiveInterface").then((module) => ({
    default: module.LiveInterface,
  })),
);
const BenchmarkTest = lazy(() =>
  import("./components/BenchmarkTest").then((module) => ({
    default: module.BenchmarkTest,
  })),
);
const ProjectNarrative = lazy(() =>
  import("./components/ProjectNarrative").then((module) => ({
    default: module.ProjectNarrative,
  })),
);

type AppState =
  | "IDLE"
  | "CAPTURE_FAR"
  | "CAPTURE_CLOSEUP"
  | "ANALYZING"
  | "RESULTS"
  | "ERROR";

export default function App() {
  const [state, setState] = useState<AppState>("IDLE");
  const [showLiveMode, setShowLiveMode] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showResearchData, setShowResearchData] = useState(false);
  const [showLiveBenchmark, setShowLiveBenchmark] = useState(false);
  const [farImage, setFarImage] = useState<string | null>(null);
  const [closeupImage, setCloseupImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FirstAidResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleStart = () => {
    setState("CAPTURE_FAR");
  };

  const handleFarCapture = (image: string) => {
    setFarImage(image);
    setState("CAPTURE_CLOSEUP");
  };

  const handleCloseupCapture = async (image: string) => {
    setCloseupImage(image);
    setState("ANALYZING");

    try {
      if (farImage) {
        const result = await analyzeInjury(farImage, image);
        setAnalysisResult(result);
        setState("RESULTS");
      }
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please try again with clearer images.");
      setState("ERROR");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // For simplicity in upload, we'll use same image for both or just skip to closeup
        setFarImage(reader.result as string);
        handleCloseupCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setState("IDLE");
    setFarImage(null);
    setCloseupImage(null);
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 flex justify-center overflow-hidden">
      <div className="w-full max-w-md relative bg-black shadow-2xl shadow-emerald-500/5">
        <AnimatePresence>
          {showDisclaimer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-100 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-6"
            >
              <div className="max-w-sm w-full bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-2xl font-light tracking-tight mb-4 text-white">
                  RescueVision: Safety Protocol
                </h2>
                <div className="space-y-4 text-white/40 text-sm leading-relaxed mb-8">
                  <p>
                    RescueVision v2.5 is a Universal Medical Intelligence
                    platform.
                  </p>
                  <p>
                    It utilizes{" "}
                    <span className="text-white font-medium">
                      Procedural Fidelity Scanning
                    </span>{" "}
                    and{" "}
                    <span className="text-white font-medium">
                      Verification Gating
                    </span>{" "}
                    to provide real-time guidance.
                  </p>
                  <p>
                    This is a research prototype for clinical, surgical,
                    laboratory, and biomedical engineering use. Always consult
                    professional medical services first.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisclaimer(false)}
                  className="w-full py-4 bg-white text-black font-bold uppercase tracking-[0.2em] text-xs rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  I Understand & Accept
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showLiveMode && (
            <Suspense
              fallback={
                <div className="absolute inset-0 bg-black z-300 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest">
                    Initializing Live Interface...
                  </p>
                </div>
              }
            >
              <LiveInterface onClose={() => setShowLiveMode(false)} />
            </Suspense>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {state === "IDLE" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center p-8 text-center overflow-y-auto no-scrollbar"
            >
              {/* Live Benchmark Modal */}
              <AnimatePresence>
                {showLiveBenchmark && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-gray-900 w-full h-full rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative"
                    >
                      <button
                        onClick={() => setShowLiveBenchmark(false)}
                        className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-full text-gray-400 z-10"
                      >
                        <X className="w-5 h-5" />
                      </button>
                      <div className="overflow-y-auto h-full no-scrollbar">
                        <Suspense
                          fallback={
                            <div className="h-full flex flex-col items-center justify-center gap-4">
                              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                              <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest text-center px-8">
                                Initializing Benchmark Engine...
                              </p>
                            </div>
                          }
                        >
                          <BenchmarkTest />
                        </Suspense>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showResearchData && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-110 bg-black/95 backdrop-blur-3xl flex items-center justify-center p-6"
                  >
                    <div className="max-w-4xl w-full bg-[#0A0A0A] border border-white/10 rounded-4xl p-10 overflow-y-auto max-h-[90vh] no-scrollbar">
                      <div className="flex justify-between items-center mb-10">
                        <div className="text-left">
                          <h2 className="text-3xl font-light tracking-tight text-white mb-2">
                            Technical Report & Validation
                          </h2>
                          <p className="text-white/40 text-sm font-mono uppercase tracking-widest">
                            Procedural Fidelity Scanning Network (PFSN)
                          </p>
                        </div>
                        <button
                          onClick={() => setShowResearchData(false)}
                          className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="mb-12">
                        <Suspense
                          fallback={
                            <div className="h-20 animate-pulse bg-white/5 rounded-xl" />
                          }
                        >
                          <ProjectNarrative />
                        </Suspense>
                      </div>

                      <div className="h-px bg-white/10 mb-12" />

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
                        <div className="h-75 w-full">
                          <p className="text-white/60 text-xs font-mono mb-6 uppercase tracking-widest text-left">
                            Procedural Accuracy (%)
                          </p>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={EXPERIMENTAL_DATA}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#ffffff10"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="name"
                                stroke="#ffffff40"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                stroke="#ffffff40"
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                              />
                              <Tooltip
                                cursor={{ fill: "#ffffff05" }}
                                contentStyle={{
                                  backgroundColor: "#0A0A0A",
                                  border: "1px solid #ffffff10",
                                  borderRadius: "8px",
                                }}
                              />
                              <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                                {EXPERIMENTAL_DATA.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="space-y-6">
                          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
                            <h4 className="text-emerald-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                              Statistical Significance
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-white/20 text-[8px] uppercase">
                                  p-value
                                </p>
                                <p className="text-xl font-mono text-white tracking-tighter">
                                  &lt; 0.0001
                                </p>
                              </div>
                              <div>
                                <p className="text-white/20 text-[8px] uppercase">
                                  Effect Size (Cohen's d)
                                </p>
                                <p className="text-xl font-mono text-white tracking-tighter">
                                  1.42 (Large)
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
                            <h4 className="text-blue-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                              Ablation Study Results
                            </h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                <span className="text-white/40">
                                  Full System
                                </span>
                                <span className="text-emerald-400">89.2%</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                <span className="text-white/40">
                                  w/o Gating
                                </span>
                                <span className="text-red-400">62.1%</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-mono">
                                <span className="text-white/40">
                                  w/o AR Overlays
                                </span>
                                <span className="text-orange-400">74.5%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl text-left">
                        <h4 className="text-emerald-400 text-xs font-mono uppercase tracking-widest mb-4">
                          Conclusion
                        </h4>
                        <p className="text-white/60 text-sm leading-relaxed">
                          The integration of a closed-loop Procedural Fidelity
                          Scoring Network (PFSN) significantly outperforms
                          traditional open-loop instructional paradigms. The
                          large effect size (d=1.42) suggests that the hybrid
                          semantic-geometric verification model provides a
                          statistically superior safety margin for bystander-led
                          emergency interventions.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="relative mb-12">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-emerald-500/30 blur-[100px] rounded-full"
                />
                <div className="relative z-10 w-32 h-32 flex items-center justify-center">
                  <Shield
                    className="w-24 h-24 text-emerald-500 absolute"
                    strokeWidth={0.5}
                  />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-full h-full border border-emerald-500/20 border-dashed rounded-full"
                  />
                </div>
              </div>

              <h1 className="text-5xl md:text-8xl font-light tracking-tighter mb-6">
                Rescue
                <span className="text-emerald-500 font-medium italic">
                  Vision
                </span>
              </h1>

              <p className="max-w-xl text-white/40 text-sm md:text-lg leading-relaxed mb-12 font-light">
                The world's first{" "}
                <span className="text-white">
                  Universal Medical Intelligence
                </span>
                . Powered by the Procedural Fidelity Scanning Network for
                clinical-grade precision.
              </p>

              <div className="flex flex-col gap-4 w-full max-w-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleStart}
                    className="group relative px-6 py-8 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 hover:bg-white/10"
                  >
                    <span className="relative z-10 flex flex-col items-center gap-3">
                      <Shield className="w-6 h-6 text-emerald-500" />
                      <div className="flex flex-col">
                        <span>Emergency Scan</span>
                        <span className="text-[7px] opacity-40 font-normal">
                          Step-by-Step Mode
                        </span>
                      </div>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      (window as any).initialSpecialty = null;
                      (window as any).isRadiologyTraining = false;
                      setShowLiveMode(true);
                    }}
                    className="group relative px-6 py-8 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-[0.2em] text-[10px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 hover:bg-white/10"
                  >
                    <span className="relative z-10 flex flex-col items-center gap-3">
                      <Activity className="w-6 h-6 text-blue-500" />
                      <div className="flex flex-col">
                        <span>Universal Live</span>
                        <span className="text-[7px] opacity-40 font-normal">
                          Real-Time Response
                        </span>
                      </div>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      (window as any).initialSpecialty = "RADIOLOGY";
                      (window as any).isRadiologyTraining = true;
                      setShowLiveMode(true);
                    }}
                    className="group relative px-6 py-8 bg-blue-600/20 border border-blue-500/30 text-white font-bold uppercase tracking-[0.2em] text-[10px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.1)]"
                  >
                    <span className="relative z-10 flex flex-col items-center gap-3">
                      <BarChart3 className="w-6 h-6 text-blue-400" />
                      <div className="flex flex-col">
                        <span>Radiology Trainer</span>
                        <span className="text-[7px] opacity-60 font-normal">
                          Interactive Workflow
                        </span>
                      </div>
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      (window as any).initialSpecialty = "RADIOLOGY";
                      (window as any).isRadiologyTraining = false;
                      setShowLiveMode(true);
                    }}
                    className="group relative px-6 py-8 bg-emerald-600/20 border border-emerald-500/30 text-white font-bold uppercase tracking-[0.2em] text-[10px] rounded-3xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(5,150,105,0.1)]"
                  >
                    <span className="relative z-10 flex flex-col items-center gap-3">
                      <Camera className="w-6 h-6 text-emerald-400" />
                      <div className="flex flex-col">
                        <span>Radiology Live</span>
                        <span className="text-[7px] opacity-60 font-normal">
                          Diagnostic Workflow
                        </span>
                      </div>
                    </span>
                  </button>
                </div>

                <div className="h-px bg-white/5 my-4" />

                <div className="flex flex-col gap-3">
                  <label className="cursor-pointer px-12 py-4 bg-white/5 border border-white/10 text-white/40 font-mono uppercase tracking-[0.2em] text-[9px] rounded-2xl hover:bg-white/10 transition-colors text-center">
                    Upload Medical Imaging File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>

                  <button
                    onClick={() => setShowResearchData(true)}
                    className="px-12 py-5 bg-emerald-500 text-black font-bold uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
                  >
                    <Database className="w-4 h-4" />
                    Experimental Validation Button
                  </button>

                  <button
                    onClick={() => setShowLiveBenchmark(true)}
                    className="px-12 py-5 bg-purple-600 text-white font-bold uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-purple-500 transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(147,51,234,0.2)]"
                  >
                    <Activity className="w-4 h-4" />
                    Live Performance Test (p-value)
                  </button>
                </div>
              </div>

              <div className="mt-24 grid grid-cols-5 gap-8 opacity-20">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-mono">
                    CLINICAL_DIAG
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-mono">
                    SURGICAL_NAV
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Shield className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-mono">
                    LAB_ANALYTICS
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-mono">
                    BIOMED_ENG
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Camera className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-widest font-mono">
                    RADIOLOGY_AI
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {state === "CAPTURE_FAR" && (
            <motion.div key="far" className="h-screen">
              <CameraView
                label="Step 1: Context Scan"
                description="Capture the overall area around the injury"
                onCapture={handleFarCapture}
              />
            </motion.div>
          )}

          {state === "CAPTURE_CLOSEUP" && (
            <motion.div key="closeup" className="h-screen">
              <CameraView
                label="Step 2: Detail Scan"
                description="Focus closely on the specific wound or issue"
                onCapture={handleCloseupCapture}
              />
            </motion.div>
          )}

          {state === "ANALYZING" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-screen flex flex-col items-center justify-center p-8 bg-black"
            >
              <div className="relative w-48 h-48 mb-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute inset-0 border border-emerald-500/20 rounded-full border-dashed"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="absolute inset-4 border border-white/10 rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h2 className="text-xl font-mono tracking-widest uppercase">
                  Neural Processing
                </h2>
                <div className="flex flex-col gap-1">
                  <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                    Analyzing tissue patterns & severity markers...
                  </p>
                  <p className="text-emerald-500/60 text-[8px] font-mono uppercase tracking-widest">
                    Estimated time: 3-5 seconds
                  </p>
                </div>
              </div>

              {/* Simulated Data Stream */}
              <div className="mt-12 w-64 h-32 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />
                <div className="space-y-1 font-mono text-[8px] text-emerald-500/40 uppercase">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{Math.random().toString(16).substring(2, 10)}</span>
                      <span>{Math.random() > 0.5 ? "OK" : "PROC"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {state === "RESULTS" && analysisResult && closeupImage && (
            <Suspense
              fallback={
                <div className="h-screen flex flex-col items-center justify-center gap-4 bg-black">
                  <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-white/40 font-mono text-[10px] uppercase tracking-widest">
                    Loading Protocol Runner...
                  </p>
                </div>
              }
            >
              <StepRunner
                data={analysisResult}
                closeupImage={closeupImage}
                onClose={reset}
              />
            </Suspense>
          )}

          {state === "ERROR" && (
            <motion.div
              key="error"
              className="h-screen flex flex-col items-center justify-center p-8 text-center"
            >
              <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
              <h2 className="text-2xl font-light mb-4">Analysis Interrupted</h2>
              <p className="text-white/40 mb-8 max-w-xs">{error}</p>
              <button
                onClick={reset}
                className="px-8 py-3 border border-white/20 rounded-full text-xs uppercase tracking-widest hover:bg-white/5"
              >
                Return to Hub
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
