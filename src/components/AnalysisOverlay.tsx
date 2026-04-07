import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, CheckCircle2, Info, ChevronRight, X, Activity } from 'lucide-react';
import { FirstAidResponse } from '../services/gemini';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';

interface AnalysisOverlayProps {
  data: FirstAidResponse;
  closeupImage: string;
  onClose: () => void;
}

export const AnalysisOverlay: React.FC<AnalysisOverlayProps> = ({ data, closeupImage, onClose }) => {
  const [activeStep, setActiveStep] = React.useState(0);

  const severityColors = {
    low: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
    high: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
    critical: 'text-red-400 border-red-400/30 bg-red-400/10',
  };

  return (
    <div className="absolute inset-0 bg-[#050505] z-50 flex flex-col overflow-hidden">
      {/* Top: Visual AR View */}
      <div className="relative h-1/3 bg-black overflow-hidden border-b border-white/10 shrink-0">
        <img 
          src={closeupImage} 
          alt="Closeup analysis" 
          className="w-full h-full object-contain opacity-60"
        />
        
        {/* AR Points Overlay */}
        <div className="absolute inset-0">
          {data.arPoints.map((point, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5 + idx * 0.2 }}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
            >
              <div className={cn(
                "w-6 h-6 rounded-full border flex items-center justify-center relative",
                point.type === 'action' ? "border-emerald-400 bg-emerald-400/20" :
                point.type === 'warning' ? "border-red-400 bg-red-400/20" :
                "border-blue-400 bg-blue-400/20"
              )}>
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* HUD Elements */}
        <div className="absolute top-4 left-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-white font-mono text-[8px] tracking-widest uppercase">SCAN_COMPLETE: {data.diagnosis}</span>
          </div>
          <div className={cn(
            "px-2 py-0.5 border rounded text-[7px] font-mono uppercase tracking-tighter inline-block w-fit",
            severityColors[data.severity]
          )}>
            SEVERITY: {data.severity}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom: Instructions Panel */}
      <div className="flex-1 bg-[#0A0A0A] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-white/5 shrink-0">
          <h3 className="text-white/40 font-mono text-[8px] uppercase tracking-[0.2em] mb-2">Emergency Protocol</h3>
          <h2 className="text-xl text-white font-light tracking-tight">{data.diagnosis}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Warnings Section */}
          {data.warnings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-mono text-[8px] uppercase tracking-wider">Critical Warnings</span>
              </div>
              <div className="space-y-2">
                {data.warnings.map((warning, i) => (
                  <div key={i} className="p-3 bg-red-400/5 border border-red-400/20 rounded-lg text-red-200/80 text-[10px] leading-relaxed">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-mono text-[8px] uppercase tracking-wider">Action Plan</span>
            </div>
            <div className="space-y-3">
              {data.steps.map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className={cn(
                    "relative pl-6 pb-3 border-l border-white/10 last:pb-0",
                    activeStep === i ? "border-emerald-400/50" : ""
                  )}
                  onClick={() => setActiveStep(i)}
                >
                  <div className={cn(
                    "absolute left-[-4.5px] top-0 w-2 h-2 rounded-full border border-white/20 transition-colors",
                    activeStep === i ? "bg-emerald-400 border-emerald-400" : "bg-black"
                  )} />
                  <div className={cn(
                    "text-[11px] leading-relaxed transition-colors cursor-pointer",
                    activeStep === i ? "text-white" : "text-white/40"
                  )}>
                    <Markdown>{step}</Markdown>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 bg-white/5 border-t border-white/10 shrink-0">
          <button 
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
            onClick={() => window.print()}
          >
            Export Medical Log
            <ChevronRight className="w-3 h-3" />
          </button>
          <p className="mt-3 text-[7px] text-white/20 text-center uppercase tracking-widest">
            Aegis Quantum v2.1 | ISEF 2026 Submission
          </p>
        </div>
      </div>
    </div>
  );
};
