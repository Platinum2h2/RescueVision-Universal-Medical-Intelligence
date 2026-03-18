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
    <div className="fixed inset-0 bg-[#050505] z-50 flex flex-col md:flex-row overflow-hidden">
      {/* Left Side: Visual AR View */}
      <div className="relative flex-1 bg-black overflow-hidden border-r border-white/10">
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
                "w-8 h-8 rounded-full border-2 flex items-center justify-center relative",
                point.type === 'action' ? "border-emerald-400 bg-emerald-400/20" :
                point.type === 'warning' ? "border-red-400 bg-red-400/20" :
                "border-blue-400 bg-blue-400/20"
              )}>
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                
                {/* Label Tooltip */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/80 border border-white/20 px-2 py-1 rounded text-[10px] text-white font-mono uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                  {point.label}
                </div>
              </div>
              
              {/* Connecting Line to Label (Visual Flair) */}
              <div className="absolute w-px h-8 bg-white/20 top-full left-1/2" />
            </motion.div>
          ))}
        </div>

        {/* HUD Elements */}
        <div className="absolute top-6 left-6 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="text-white font-mono text-[10px] tracking-widest uppercase">SCAN_COMPLETE: {data.diagnosis}</span>
          </div>
          <div className={cn(
            "px-2 py-0.5 border rounded text-[9px] font-mono uppercase tracking-tighter inline-block w-fit",
            severityColors[data.severity]
          )}>
            SEVERITY: {data.severity}
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Right Side: Instructions Panel */}
      <div className="w-full md:w-[400px] bg-[#0A0A0A] flex flex-col border-l border-white/10">
        <div className="p-8 border-b border-white/5">
          <h3 className="text-white/40 font-mono text-[10px] uppercase tracking-[0.2em] mb-4">Emergency Protocol</h3>
          <h2 className="text-2xl text-white font-light tracking-tight">{data.diagnosis}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Warnings Section */}
          {data.warnings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-mono text-[10px] uppercase tracking-wider">Critical Warnings</span>
              </div>
              <div className="space-y-2">
                {data.warnings.map((warning, i) => (
                  <div key={i} className="p-3 bg-red-400/5 border border-red-400/20 rounded-lg text-red-200/80 text-xs leading-relaxed">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-mono text-[10px] uppercase tracking-wider">Action Plan</span>
            </div>
            <div className="space-y-4">
              {data.steps.map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className={cn(
                    "relative pl-8 pb-4 border-l border-white/10 last:pb-0",
                    activeStep === i ? "border-emerald-400/50" : ""
                  )}
                  onClick={() => setActiveStep(i)}
                >
                  <div className={cn(
                    "absolute left-[-5px] top-0 w-2 h-2 rounded-full border border-white/20 transition-colors",
                    activeStep === i ? "bg-emerald-400 border-emerald-400" : "bg-black"
                  )} />
                  <div className={cn(
                    "text-xs leading-relaxed transition-colors cursor-pointer",
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
        <div className="p-8 bg-white/5 border-t border-white/10">
          <button 
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2"
            onClick={() => window.print()}
          >
            Export Medical Log
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="mt-4 text-[9px] text-white/20 text-center uppercase tracking-widest">
            Aegis Quantum v2.1 | ISEF 2026 Submission
          </p>
        </div>
      </div>
    </div>
  );
};
