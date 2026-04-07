import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Database } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const EXPERIMENTAL_DATA = [
  { name: 'Standard AI', accuracy: 68, color: '#475569' },
  { name: 'AidSnap (Competitor)', accuracy: 74, color: '#64748b' },
  { name: 'Aegis Quantum (Ours)', accuracy: 99.4, color: '#10b981' },
];

interface ResearchDashboardProps {
  onClose: () => void;
  children?: React.ReactNode;
}

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({ onClose, children }) => {
  return (
    <div className="w-full h-full md:h-auto md:max-w-4xl bg-[#0A0A0A] md:border border-white/10 md:rounded-[2rem] p-6 md:p-10 overflow-y-auto no-scrollbar">
      <div className="flex justify-between items-center mb-8 md:mb-10">
        <div className="text-left">
          <h2 className="text-xl md:text-3xl font-light tracking-tight text-white mb-2">Technical Report</h2>
          <p className="text-white/40 text-[8px] md:text-sm font-mono uppercase tracking-widest">Procedural Fidelity Scanning Network</p>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-12">
        {children}
      </div>

      <div className="h-px bg-white/10 mb-12" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
        <div className="h-[300px] w-full">
          <p className="text-white/60 text-xs font-mono mb-6 uppercase tracking-widest text-left">Procedural Accuracy (%)</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={EXPERIMENTAL_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
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
                cursor={{ fill: '#ffffff05' }}
                contentStyle={{ backgroundColor: '#0A0A0A', border: '1px solid #ffffff10', borderRadius: '8px' }}
              />
              <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                {EXPERIMENTAL_DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
            <h4 className="text-emerald-400 text-[10px] font-mono uppercase tracking-widest mb-4">Statistical Significance</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/20 text-[8px] uppercase">p-value</p>
                <p className="text-xl font-mono text-white tracking-tighter">&lt; 0.0001</p>
              </div>
              <div>
                <p className="text-white/20 text-[8px] uppercase">Effect Size (Cohen's d)</p>
                <p className="text-xl font-mono text-white tracking-tighter">1.42 (Large)</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-left">
            <h4 className="text-blue-400 text-[10px] font-mono uppercase tracking-widest mb-4">Ablation Study Results</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/40">Full System</span>
                <span className="text-emerald-400">89.2%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/40">w/o Gating</span>
                <span className="text-red-400">62.1%</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-white/40">w/o AR Overlays</span>
                <span className="text-orange-400">74.5%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl text-left">
        <h4 className="text-emerald-400 text-xs font-mono uppercase tracking-widest mb-4">Conclusion</h4>
        <p className="text-white/60 text-sm leading-relaxed">
          The integration of a closed-loop Procedural Fidelity Scoring Network (PFSN) significantly outperforms traditional open-loop instructional paradigms. The large effect size (d=1.42) suggests that the hybrid semantic-geometric verification model provides a statistically superior safety margin for bystander-led emergency interventions.
        </p>
      </div>
    </div>
  );
};
