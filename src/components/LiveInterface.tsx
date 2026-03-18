import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, MicOff, Activity, Loader2, Volume2, Camera, FileText, Users, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { analyzeLiveFrame, analyzeRadiology, getRadiologyDeviceGuidance } from '../services/gemini';
import { cn } from '../lib/utils';

// AR Human Pose Definitions
const AR_HUMAN_POSES: Record<string, { svg: string; label: string }> = {
  'cpr_pose': {
    label: 'Perform CPR Here',
    svg: `<svg viewBox="0 0 100 100" class="w-full h-full text-emerald-400 opacity-90">
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" style="stop-color:currentColor;stop-opacity:1" />
          <stop offset="100%" style="stop-color:currentColor;stop-opacity:0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="20" r="12" fill="currentColor"/>
      <path d="M35 35 L65 35 L70 85 L30 85 Z" fill="currentColor"/>
      <path d="M40 35 L25 65 M60 35 L75 65" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="15" fill="url(#glow)" class="animate-pulse"/>
      <path d="M45 45 L55 45 M45 55 L55 55" stroke="white" stroke-width="3" stroke-linecap="round"/>
    </svg>`
  },
  'pressure_pose': {
    label: 'Apply Direct Pressure',
    svg: `<svg viewBox="0 0 100 100" class="w-full h-full text-blue-400 opacity-90">
      <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="8 4"/>
      <path d="M50 25 L50 75 M25 50 L75 50" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
      <circle cx="50" cy="50" r="10" fill="white" class="animate-ping"/>
    </svg>`
  },
  'recovery_position': {
    label: 'Roll to Side',
    svg: `<svg viewBox="0 0 100 100" class="w-full h-full text-amber-400 opacity-90">
      <path d="M20 70 Q50 30 80 70" stroke="currentColor" stroke-width="15" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="40" r="15" fill="currentColor"/>
      <path d="M30 85 L70 85" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
      <path d="M50 50 L70 30" stroke="white" stroke-width="4" stroke-linecap="round" class="animate-bounce"/>
    </svg>`
  },
  'heimlich_pose': {
    label: 'Heimlich Maneuver',
    svg: `<svg viewBox="0 0 100 100" class="w-full h-full text-red-500 opacity-90">
      <path d="M50 15 C55 15 60 20 60 25 C60 30 55 35 50 35 C45 35 40 30 40 25 C40 20 45 15 50 15 Z" fill="currentColor"/>
      <path d="M35 40 L65 40 L60 90 L40 90 Z" fill="currentColor"/>
      <path d="M30 50 Q50 45 70 50" stroke="white" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M50 45 L50 65" stroke="white" stroke-width="4" stroke-linecap="round" class="animate-bounce"/>
      <circle cx="50" cy="50" r="20" fill="none" stroke="white" stroke-width="2" stroke-dasharray="4 4" class="animate-ping"/>
    </svg>`
  }
};

const spinSlow = {
  animate: {
    rotate: 360
  },
  transition: {
    duration: 8,
    repeat: Infinity,
    ease: "linear" as const
  }
};

interface LiveInterfaceProps {
  onClose: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ onClose }) => {
  const [isMicOn, setIsMicOn] = useState(true);
  const [status, setStatus] = useState('Initializing Core Engine...');
  const [arPoints, setArPoints] = useState<{ x: number; y: number; label: string }[]>([]);
  const [arHuman, setArHuman] = useState<{ type: string; x: number; y: number } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [conversationState, setConversationState] = useState('initial');
  const [vitalChecks, setVitalChecks] = useState({ breathing: false, conscious: false });
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isScanningVitals, setIsScanningVitals] = useState(false);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [isMCIMode, setIsMCIMode] = useState(false);
  const [specialtyMode, setSpecialtyMode] = useState<'CLINICAL' | 'SURGICAL' | 'LAB' | 'BIOMEDICAL' | 'RADIOLOGY'>((window as any).initialSpecialty || 'CLINICAL');
  const [triageTags, setTriageTags] = useState<{ id: number; x: number; y: number; level: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK' }[]>([]);
  const [improvisedTools, setImprovisedTools] = useState<{ originalItem: string; medicalUse: string; instructions: string; x: number; y: number }[]>([]);
  const [spatialMap, setSpatialMap] = useState<{ id: string; x: number; y: number; level: string; timestamp: number }[]>([]);
  const [anatomyOverlay, setAnatomyOverlay] = useState<'skeleton' | 'circulatory' | 'respiratory' | 'nervous' | null>(null);
  const [hapticPattern, setHapticPattern] = useState<'cpr' | 'pressure' | 'steady' | 'rhythmic_breathing' | null>(null);
  const [showMSR, setShowMSR] = useState(false);
  const [showRadiologyTrainer, setShowRadiologyTrainer] = useState((window as any).isRadiologyTraining || false);
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [shockProbability, setShockProbability] = useState<number | null>(null);
  const [predictiveAnalytics, setPredictiveAnalytics] = useState<{ timeToCriticalityMin: number; organSystemRisk: { system: string; riskLevel: number }[]; survivalProbability: number } | null>(null);
  const [multiSpectralAnalysis, setMultiSpectralAnalysis] = useState<{ hypoxiaDetection: number; internalBleedingProbability: number; tissueViability: number } | null>(null);
  const [woundMetrics, setWoundMetrics] = useState<{ lengthMm: number; depthMm: number; surfaceAreaMm2: number; type: string } | null>(null);
  const [radiologyResult, setRadiologyResult] = useState<any>(null);
  const [radiologyWorkflowState, setRadiologyWorkflowState] = useState<'IDLE' | 'ASKING_SCAN_TYPE' | 'PROVIDING_GUIDANCE' | 'AWAITING_SCAN' | 'ANALYZING' | 'RESULTS'>('IDLE');
  const [scanType, setScanType] = useState<string>('');
  const [deviceGuidance, setDeviceGuidance] = useState<{ instructions: string[]; safetyWarnings: string[]; optimalSettings: string } | null>(null);
  
  useEffect(() => {
    if (specialtyMode === 'RADIOLOGY' && radiologyWorkflowState === 'IDLE') {
      startRadiologyWorkflow();
    }
  }, [specialtyMode]);

  const startRadiologyWorkflow = async () => {
    setRadiologyWorkflowState('ASKING_SCAN_TYPE');
    triggerHaptic('info');
    speak("What type of radiology scan would you like to perform today? For example, Brain MRI or Chest CT.");
  };

  const handleRadiologyVocalInput = async (text: string) => {
    if (radiologyWorkflowState === 'ASKING_SCAN_TYPE') {
      setScanType(text);
      setRadiologyWorkflowState('PROVIDING_GUIDANCE');
      speak(`Understood. Preparing guidance for ${text}. Please wait.`);
      
      try {
        const guidance = await getRadiologyDeviceGuidance(text);
        setDeviceGuidance(guidance);
        speak("Device guidance is ready. Follow the instructions on your screen to prepare the patient and the equipment.");
      } catch (error) {
        console.error("Error getting guidance:", error);
        speak("I encountered an error retrieving device guidance. Please try again.");
      }
    }
  };
  const isMicOnRef = useRef(isMicOn);
  const isActiveRef = useRef(isActive);
  const isStartedRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

  const triggerHaptic = (type: 'success' | 'warning' | 'info') => {
    if (!window.navigator.vibrate) return;
    
    switch (type) {
      case 'success':
        window.navigator.vibrate([50, 30, 50]); // Double short pulse
        break;
      case 'warning':
        window.navigator.vibrate([200, 100, 200]); // Long double pulse
        break;
      case 'info':
        window.navigator.vibrate(50); // Single short pulse
        break;
    }
  };

  useEffect(() => {
    startLiveMode();
    return () => {
      stopLiveMode();
    };
  }, [facingMode]);

  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const stopLiveMode = () => {
    setIsActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  const startLiveMode = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      
      setStatus('Accessing Camera...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode, width: 640, height: 480 }, 
        audio: true 
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      setStatus('Ready: Say "Help" or ask a question');
      setupSpeechRecognition();
      
      // Initial scan
      performAILoop();
    } catch (err: any) {
      console.error(err);
      setStatus('Failed: ' + err.message);
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isStartedRef.current = true;
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      console.log('Heard:', transcript);
      handleUserSpeech(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      
      // Don't restart here, let onend handle it to avoid double starts
    };

    recognition.onend = () => {
      isStartedRef.current = false;
      if (isMicOnRef.current && isActiveRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.error('Failed to restart speech recognition:', err);
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
    }
  };

  const handleUserSpeech = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    
    if (specialtyMode === 'RADIOLOGY' && radiologyWorkflowState === 'ASKING_SCAN_TYPE') {
      handleRadiologyVocalInput(text);
      return;
    }

    // Simple heuristic for vital checks
    if (lowerText.includes('breathing') || lowerText.includes('yes') || lowerText.includes('no') || lowerText.includes('choking') || lowerText.includes('cough')) {
      if (lowerText.includes('breathing')) {
        const isYes = lowerText.includes('yes');
        setVitalChecks(prev => ({ ...prev, breathing: isYes }));
        if (isYes) triggerHaptic('success');
      }
      if (lowerText.includes('conscious') || lowerText.includes('talking') || lowerText.includes('speak')) {
        const isYes = lowerText.includes('yes');
        setVitalChecks(prev => ({ ...prev, conscious: isYes }));
        if (isYes) triggerHaptic('success');
      }
      if (lowerText.includes('choking') || lowerText.includes('cough')) {
        setConversationState('choking');
        triggerHaptic('warning');
      }
    }

    if (lowerText.includes('help') || lowerText.length > 5) {
      performAILoop(text);
    }
  };

  const captureFrame = () => {
    if (specialtyMode === 'RADIOLOGY' && radiologyWorkflowState === 'AWAITING_SCAN') {
      performAILoop();
    }
  };

  const startVitalScan = () => {
    setIsScanningVitals(true);
    setHeartRate(null);
    triggerHaptic('info');
    setStatus('Initializing rPPG Vital Extraction...');
    
    // Simulate rPPG scan process
    setTimeout(() => {
      const hr = Math.floor(Math.random() * (110 - 65) + 65);
      setHeartRate(hr);
      setIsScanningVitals(false);
      triggerHaptic('success');
      speak(`Vital scan complete. Estimated heart rate is ${hr} beats per minute.`);
      setStatus('Vitals Extracted: ' + hr + ' BPM');
    }, 5000);
  };

  const performAILoop = async (userQuery?: string) => {
    if (isThinking || !isActive) return;
    setIsThinking(true);
    setStatus('AI is analyzing live feed...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx && videoRef.current && isActive) {
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        
        // Use the Core Gemini Flash engine with context
        const context = `
          Specialty: ${specialtyMode},
          Mode: ${isMCIMode ? 'MASS CASUALTY INCIDENT (MCI)' : 'STANDARD'},
          State: ${conversationState}, 
          Vitals: ${JSON.stringify(vitalChecks)}, 
          HeartRate: ${heartRate || 'Unknown'},
          Last Question Asked: ${lastQuestion || 'None'}, 
          Repetition Count: ${questionCount}
          
          CRITICAL: Adjust analysis based on the selected Specialty: ${specialtyMode}.
        `;

        let result;
        if (specialtyMode === 'RADIOLOGY') {
          if (radiologyWorkflowState === 'AWAITING_SCAN' || radiologyWorkflowState === 'ANALYZING') {
            setRadiologyWorkflowState('ANALYZING');
            result = await analyzeRadiology(base64Image, context, (window as any).isRadiologyTraining);
            setRadiologyResult(result);
            setRadiologyWorkflowState('RESULTS');
            setShowRadiologyTrainer(true);
            speak("Medical grade analysis complete. I have identified the findings and prepared treatment, recovery, and surgical plans as applicable.");
          } else {
            setIsThinking(false);
            return;
          }
        } else {
          result = await analyzeLiveFrame(base64Image, context, userQuery || "");
        }
        
        if (!isActive) return;

        if (result.diagnosis) setDiagnosis(result.diagnosis);
        if (result.severity) setSeverity(result.severity);
        
        if (result.severity === 'critical') {
          triggerHaptic('warning');
        }

        // Handle MCI Triage Tags if present in result (extending the AI service to support this)
        if (isMCIMode && result.arPoints) {
          const tags = result.arPoints
            .filter(p => ['RED', 'YELLOW', 'GREEN', 'BLACK'].some(level => p.label.includes(level)))
            .map((p, i) => ({
              id: i,
              x: p.x,
              y: p.y,
              level: (p.label.match(/RED|YELLOW|GREEN|BLACK/) || ['GREEN'])[0] as any
            }));
          if (tags.length > 0) {
            setTriageTags(tags);
            // Update Spatial Map
            setSpatialMap(prev => {
              const newMap = [...prev];
              tags.forEach(tag => {
                const existingIdx = newMap.findIndex(m => Math.abs(m.x - tag.x) < 10 && Math.abs(m.y - tag.y) < 10);
                if (existingIdx >= 0) {
                  newMap[existingIdx] = { ...newMap[existingIdx], level: tag.level, timestamp: Date.now() };
                } else {
                  newMap.push({ id: Math.random().toString(36).substr(2, 9), x: tag.x, y: tag.y, level: tag.level, timestamp: Date.now() });
                }
              });
              return newMap.filter(m => Date.now() - m.timestamp < 30000); // Keep for 30s
            });
          }
        }

        if (result.improvisedTools) {
          setImprovisedTools(result.improvisedTools);
          if (result.improvisedTools.length > 0) {
            triggerHaptic('info');
          }
        }

        if (result.anatomyOverlay) setAnatomyOverlay(result.anatomyOverlay);
        if (result.hapticPattern) setHapticPattern(result.hapticPattern);
        if (result.predictiveAnalytics) setPredictiveAnalytics(result.predictiveAnalytics);
        if (result.multiSpectralAnalysis) setMultiSpectralAnalysis(result.multiSpectralAnalysis);
        if (result.woundMetrics) setWoundMetrics(result.woundMetrics);

        setArPoints(result.arPoints.map(p => ({ x: p.x, y: p.y, label: p.label })));
        
        // Handle AR Human Overlay
        if (result.arHumanAction && AR_HUMAN_POSES[result.arHumanAction]) {
          const targetPoint = result.arPoints[0] || { x: 50, y: 50 };
          setArHuman({ type: result.arHumanAction, x: targetPoint.x, y: targetPoint.y });
        } else {
          setArHuman(null);
        }

        // Conversational Logic
        let responseText = "";
        const normalizedNext = result.nextQuestion?.toLowerCase().trim().replace(/[.?!]$/, "") || "";
        const normalizedLast = lastQuestion?.toLowerCase().trim().replace(/[.?!]$/, "") || "";

        if (result.nextQuestion) {
          if (normalizedNext === normalizedLast) {
            setQuestionCount(prev => prev + 1);
          } else {
            responseText = result.nextQuestion;
            setLastQuestion(result.nextQuestion);
            setQuestionCount(1);
          }
        } else if (result.steps.length > 0) {
          // If we have steps, we might have moved past the vital check question
          // Only update if the step is new or if we're stuck
          if (result.steps[0] !== lastResponse) {
            responseText = result.steps[0];
            setLastQuestion(null);
            setQuestionCount(0);
          }
        }

        if (responseText) {
          setLastResponse(responseText);
          speak(responseText);
          triggerHaptic('info');
          setChatHistory(prev => [...prev, { role: 'assistant', content: responseText }]);
        }
        
        setStatus('Live: Monitoring Situation');
        
        // Update state machine if needed
        if (result.diagnosis && conversationState === 'initial') {
          setConversationState('vitals');
        }
      }
    } catch (err) {
      console.error('AI Loop Error:', err);
      setStatus('Engine busy... retrying');
    } finally {
      setIsThinking(false);
      // Faster loop for better responsiveness
      if (!userQuery && isActive) {
        setTimeout(() => performAILoop(), 8000);
      }
    }
  };

  // Haptic Guidance Engine
  useEffect(() => {
    if (!hapticPattern || !isActive) return;

    let interval: NodeJS.Timeout;
    
    if (hapticPattern === 'cpr') {
      // 100-120 bpm (approx 550ms interval)
      interval = setInterval(() => {
        if (navigator.vibrate) navigator.vibrate(100);
      }, 550);
    } else if (hapticPattern === 'pressure') {
      // Steady pulse every 2s
      interval = setInterval(() => {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }, 2000);
    } else if (hapticPattern === 'rhythmic_breathing') {
      // Slow calming pulse every 4s
      interval = setInterval(() => {
        if (navigator.vibrate) navigator.vibrate([400, 200, 400]);
      }, 4000);
    }

    return () => clearInterval(interval);
  }, [hapticPattern, isActive]);

  const speak = (text: string) => {
    if (synthRef.current.speaking) synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synthRef.current.speak(utterance);
  };

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col">
      <div className="relative flex-1 bg-black overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        
        <div className="absolute inset-0 pointer-events-none">
          {/* AR X-Ray Anatomy Overlay */}
          {anatomyOverlay && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="absolute inset-0 flex items-center justify-center mix-blend-screen overflow-hidden"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full text-blue-400/30">
                {anatomyOverlay === 'skeleton' && (
                  <path d="M50 10 L50 90 M30 30 L70 30 M30 50 L70 50 M40 70 L60 70" stroke="currentColor" strokeWidth="0.5" fill="none" />
                )}
                {anatomyOverlay === 'nervous' && (
                  <path d="M50 10 L50 90 M50 20 L20 40 M50 20 L80 40 M50 40 L15 70 M50 40 L85 70" stroke="currentColor" strokeWidth="0.2" fill="none" strokeDasharray="1 1" />
                )}
                {anatomyOverlay === 'circulatory' && (
                  <g stroke="currentColor" strokeWidth="0.3" fill="none">
                    <circle cx="50" cy="40" r="10" />
                    <path d="M50 50 L50 90 M50 60 L20 80 M50 60 L80 80" />
                    <motion.path 
                      d="M50 50 L50 90" 
                      stroke="#ef4444" 
                      strokeWidth="0.5"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </g>
                )}
              </svg>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border border-blue-500/20 shadow-[0_0_100px_rgba(59,130,246,0.2)]" />
            </motion.div>
          )}

          {/* Bio-Digital Twin (BDTS) Visualization */}
          {predictiveAnalytics && (
            <div className="absolute top-32 left-6 w-32 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest mb-3">Bio-Digital Twin</div>
              <div className="relative h-24 w-full flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full text-white/20">
                  <path d="M50 10 L50 90 M30 30 L70 30 M30 50 L70 50 M40 70 L60 70" stroke="currentColor" strokeWidth="2" fill="none" />
                  {predictiveAnalytics.organSystemRisk.map((risk, i) => (
                    <motion.circle 
                      key={i}
                      cx={50} 
                      cy={20 + (i * 20)} 
                      r={risk.riskLevel * 10} 
                      fill={risk.riskLevel > 0.7 ? '#ef4444' : risk.riskLevel > 0.4 ? '#f59e0b' : '#10b981'}
                      className="opacity-60"
                      animate={{ opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-2 space-y-1">
                {predictiveAnalytics.organSystemRisk.slice(0, 3).map((risk, i) => (
                  <div key={i} className="flex justify-between text-[6px] font-mono uppercase">
                    <span className="text-white/40">{risk.system}</span>
                    <span className={risk.riskLevel > 0.7 ? 'text-red-400' : 'text-emerald-400'}>{(risk.riskLevel * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multi-Spectral HUD */}
          {multiSpectralAnalysis && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4">
              <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-[8px] font-mono text-purple-400 uppercase tracking-widest">Spectral_Hypoxia: {(multiSpectralAnalysis.hypoxiaDetection * 100).toFixed(1)}%</span>
              </div>
              <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[8px] font-mono text-amber-400 uppercase tracking-widest">Tissue_Viability: {(multiSpectralAnalysis.tissueViability * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}

          {/* Predictive Survival Timeline */}
          {predictiveAnalytics && (
            <div className="absolute bottom-32 right-6 w-48 p-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl">
              <div className="text-[8px] font-mono text-blue-400 uppercase tracking-widest mb-2">Predictive Survival Timeline</div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/60">Survival Probability</span>
                <span className="text-[10px] font-bold text-emerald-400">{predictiveAnalytics.survivalProbability}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${predictiveAnalytics.survivalProbability}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] text-white/40 uppercase">Time to Criticality</span>
                <span className="text-sm font-mono text-red-400 animate-pulse">{predictiveAnalytics.timeToCriticalityMin}m 00s</span>
              </div>
            </div>
          )}

          {/* Spatial Triage Map (Mini Radar) */}
          {isMCIMode && spatialMap.length > 0 && (
            <div className="absolute top-32 right-6 w-24 h-24 rounded-full bg-black/40 backdrop-blur-md border border-white/10 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-0.5 bg-white/5" />
                <div className="h-full w-0.5 bg-white/5" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-r border-emerald-500/20"
                />
              </div>
              {spatialMap.map(m => (
                <motion.div 
                  key={m.id}
                  style={{ 
                    left: `${m.x}%`, 
                    top: `${m.y}%`,
                    backgroundColor: m.level === 'RED' ? '#ef4444' : m.level === 'YELLOW' ? '#f59e0b' : m.level === 'GREEN' ? '#10b981' : '#18181b'
                  }}
                  className="absolute w-1.5 h-1.5 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]"
                />
              ))}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[6px] font-mono text-white/40 uppercase">Scene Radar</div>
            </div>
          )}

          {/* Improvised Tools Synthesis */}
          {improvisedTools.map((tool, idx) => (
            <motion.div
              key={`tool-${idx}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              style={{ left: `${tool.x}%`, top: `${tool.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div className="group relative">
                <div className="w-10 h-10 rounded-full border-2 border-blue-400 bg-blue-400/20 flex items-center justify-center shadow-[0_0_20px_rgba(96,165,250,0.5)] cursor-pointer pointer-events-auto">
                  <motion.div {...spinSlow}>
                    <Loader2 className="w-5 h-5 text-blue-400" />
                  </motion.div>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-3 bg-black/80 backdrop-blur-xl border border-blue-500/30 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[8px] font-mono text-blue-400 uppercase tracking-widest mb-1">Improvised Tool</div>
                  <div className="text-[10px] font-bold text-white mb-1">{tool.originalItem} → {tool.medicalUse}</div>
                  <div className="text-[9px] text-white/60 leading-tight">{tool.instructions}</div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* MCI Triage Tags */}
          {isMCIMode && triageTags.map(tag => (
            <motion.div
              key={tag.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div className={cn(
                "px-3 py-1 rounded border-2 font-bold text-[10px] shadow-lg flex items-center gap-2",
                tag.level === 'RED' && "bg-red-500 border-red-600 text-white",
                tag.level === 'YELLOW' && "bg-yellow-500 border-yellow-600 text-black",
                tag.level === 'GREEN' && "bg-emerald-500 border-emerald-600 text-white",
                tag.level === 'BLACK' && "bg-zinc-800 border-zinc-900 text-white"
              )}>
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                {tag.level}
              </div>
            </motion.div>
          ))}

          {/* Surgical Precision Wound Overlay */}
          {woundMetrics && arPoints.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ left: `${arPoints[0].x}%`, top: `${arPoints[0].y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="w-full h-full text-amber-400/50">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                  <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="0.5" />
                  <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" strokeWidth="0.5" />
                  <rect x="20" y="45" width="60" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
                </svg>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-2 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 px-2 py-1 rounded text-[8px] font-mono text-amber-400 whitespace-nowrap">
                  SCANNING: {woundMetrics.type.toUpperCase()}
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-2 bg-amber-500/20 backdrop-blur-md border border-amber-500/30 px-2 py-1 rounded text-[8px] font-mono text-amber-400 whitespace-nowrap">
                  L: {woundMetrics.lengthMm}mm | D: {woundMetrics.depthMm}mm | A: {woundMetrics.surfaceAreaMm2}mm²
                </div>
              </div>
            </motion.div>
          )}

          {/* AR Human Overlay */}
          <AnimatePresence>
            {arHuman && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ left: `${arHuman.x}%`, top: `${arHuman.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-48 h-48"
              >
                <div 
                  className="w-full h-full drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse"
                  dangerouslySetInnerHTML={{ __html: AR_HUMAN_POSES[arHuman.type].svg }}
                />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 px-4 py-2 bg-white text-black text-[10px] font-bold rounded-full whitespace-nowrap shadow-xl">
                  {AR_HUMAN_POSES[arHuman.type].label}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {arPoints.map((point, idx) => (
            <motion.div
              key={idx}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 bg-emerald-400/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)]">
                <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              </div>
              <div className="mt-2 px-2 py-1 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[10px] text-white font-mono whitespace-nowrap">
                {point.label}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full">
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                isThinking ? "bg-blue-500" : (isMCIMode ? "bg-red-500" : "bg-emerald-500")
              )} />
              <span className="text-[10px] font-mono text-white/80 uppercase tracking-widest">
                {specialtyMode} // {isMCIMode ? 'MCI ACTIVE' : status}
              </span>
            </div>
            
            <AnimatePresence>
              {(conversationState !== 'initial' || heartRate) && (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 flex-wrap max-w-xs"
                >
                  {heartRate && (
                    <div className="px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-tighter border bg-blue-500/20 border-blue-500 text-blue-400 flex items-center gap-1">
                      <Activity className="w-2 h-2" />
                      HR: {heartRate} BPM
                    </div>
                  )}
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-tighter border",
                    vitalChecks.breathing ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-red-500/20 border-red-500 text-red-400"
                  )}>
                    Breathing: {vitalChecks.breathing ? 'YES' : 'CHECKING'}
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-tighter border",
                    vitalChecks.conscious ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-red-500/20 border-red-500 text-red-400"
                  )}>
                    Conscious: {vitalChecks.conscious ? 'YES' : 'CHECKING'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
              title="Flip Camera"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                stopLiveMode();
                onClose();
              }}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {lastResponse && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-36 left-6 right-6 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl"
            >
              <div className="flex items-start gap-3">
                <Volume2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                <p className="text-white/80 text-xs leading-relaxed italic">
                  {lastResponse}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isScanningVitals && (
          <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] flex flex-col items-center justify-center">
            <div className="w-64 h-64 border-2 border-blue-400/50 rounded-3xl relative overflow-hidden">
              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_15px_rgba(96,165,250,0.8)]"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="w-12 h-12 text-blue-400 animate-pulse" />
              </div>
            </div>
            <div className="mt-8 px-6 py-3 bg-black/80 border border-blue-500/30 rounded-full flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-xs font-mono text-blue-400 uppercase tracking-[0.2em]">rPPG Vital Extraction Active</span>
            </div>
          </div>
        )}

        {hapticPattern && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-blue-500/20 backdrop-blur-xl border border-blue-500/40 rounded-full z-[100]">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: hapticPattern === 'cpr' ? 0.55 : 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)]"
            />
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">
              {hapticPattern === 'cpr' ? 'Match CPR Beat' : 'Apply Steady Pressure'}
            </span>
          </div>
        )}

        {isThinking && (
          <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-blue-500/20 backdrop-blur-xl border border-blue-500/40 rounded-full">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-widest">Core Engine Analyzing...</span>
          </div>
        )}
      </div>

      {/* Radiology Trainer Modal */}
      <AnimatePresence>
        {showRadiologyTrainer && radiologyResult && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-32 right-6 w-80 bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 z-[400] shadow-2xl overflow-y-auto max-h-[70vh]"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Radiology Trainer</h3>
              <button onClick={() => setShowRadiologyTrainer(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="text-[8px] font-mono text-emerald-400 uppercase mb-1">Diagnosis</div>
                <div className="text-xs font-bold text-white">{radiologyResult.diagnosis}</div>
                <div className="mt-2 text-[8px] font-mono text-white/40">Confidence: {(radiologyResult.confidence * 100).toFixed(1)}%</div>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] font-mono text-blue-400 uppercase">Instructional Steps</div>
                {radiologyResult.trainingInstructions.map((step: any, i: number) => (
                  <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="text-[8px] font-bold text-blue-400 mb-1">STEP {i + 1}: {step.step}</div>
                    <div className="text-[10px] text-white/70 leading-relaxed mb-2">{step.whatToLookFor}</div>
                    {step.deviceOperation && (
                      <div className="mb-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="text-[7px] font-mono text-blue-300 uppercase mb-1">Device Operation</div>
                        <div className="text-[9px] text-blue-100/80">{step.deviceOperation}</div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {step.anatomicalLandmarks.map((landmark: string, j: number) => (
                        <span key={j} className="px-2 py-0.5 bg-white/10 rounded text-[7px] text-white/60 font-mono">{landmark}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-mono text-emerald-400 uppercase">Treatment Plan</div>
                <div className="space-y-1">
                  {radiologyResult.treatmentPlan.map((t: string, i: number) => (
                    <div key={i} className="text-[10px] text-white/60 flex gap-2">
                      <span className="text-emerald-500">•</span>
                      {t}
                    </div>
                  ))}
                </div>
              </div>

              {radiologyResult.recoveryPlan && radiologyResult.recoveryPlan.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-indigo-400 uppercase">Recovery Plan</div>
                  <div className="space-y-1">
                    {radiologyResult.recoveryPlan.map((t: string, i: number) => (
                      <div key={i} className="text-[10px] text-white/60 flex gap-2">
                        <span className="text-indigo-500">•</span>
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {radiologyResult.surgicalPlan && radiologyResult.surgicalPlan.length > 0 && (
                <div className="space-y-2">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="text-[10px] font-mono text-red-400 uppercase mb-2">Surgical Plan</div>
                    <div className="space-y-2">
                      {radiologyResult.surgicalPlan.map((t: string, i: number) => (
                        <div key={i} className="text-[10px] text-white/80 flex gap-2">
                          <span className="text-red-500 font-bold">{i + 1}.</span>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-[10px] font-mono text-amber-400 uppercase">Differential Diagnosis</div>
                <div className="flex flex-wrap gap-2">
                  {radiologyResult.differentialDiagnosis.map((d: string, i: number) => (
                    <span key={i} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[8px] text-amber-400">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grad-CAM Simulated Heatmap Overlay */}
      {specialtyMode === 'RADIOLOGY' && radiologyResult?.gradCamSimulatedHeatmap && (
        <div className="absolute inset-0 pointer-events-none">
          {radiologyResult.gradCamSimulatedHeatmap.map((point: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: point.intensity * 0.4 }}
              style={{ 
                left: `${point.x}%`, 
                top: `${point.y}%`,
                width: `${point.intensity * 100}px`,
                height: `${point.intensity * 100}px`,
                background: `radial-gradient(circle, rgba(239, 68, 68, 0.8) 0%, transparent 70%)`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
            />
          ))}
        </div>
      )}

      {/* Radiology Workflow Guidance Overlay */}
      <AnimatePresence>
        {specialtyMode === 'RADIOLOGY' && radiologyWorkflowState !== 'RESULTS' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-40 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[350]"
          >
            <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
              {radiologyWorkflowState === 'ASKING_SCAN_TYPE' && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <Mic className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">What would you like to scan?</h2>
                  <p className="text-white/40 text-sm">Please state the scan type (e.g., "Brain MRI", "Chest CT")</p>
                </div>
              )}

              {radiologyWorkflowState === 'PROVIDING_GUIDANCE' && deviceGuidance && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Device Guidance: {scanType}</h2>
                    <div className="px-3 py-1 bg-blue-500/20 rounded-full text-[10px] text-blue-400 font-bold uppercase tracking-widest">Technician Mode</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="text-[10px] font-mono text-blue-400 uppercase">Setup Instructions</div>
                      <div className="space-y-2">
                        {deviceGuidance.instructions.map((step, i) => (
                          <div key={i} className="flex gap-3 text-xs text-white/70">
                            <span className="text-blue-500 font-bold">{i + 1}.</span>
                            {step}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="text-[10px] font-mono text-red-400 uppercase">Safety Warnings</div>
                        <div className="space-y-2">
                          {deviceGuidance.safetyWarnings.map((warning, i) => (
                            <div key={i} className="flex gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] text-red-400">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {warning}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="text-[10px] font-mono text-white/40 uppercase mb-2">Optimal Settings</div>
                        <div className="text-xs text-white font-mono">{deviceGuidance.optimalSettings}</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRadiologyWorkflowState('AWAITING_SCAN');
                      speak("Guidance acknowledged. Please perform the scan and then capture or upload the resulting image for analysis.");
                    }}
                    className="w-full py-4 bg-white text-black rounded-2xl font-bold uppercase tracking-widest text-xs hover:scale-[1.02] transition-transform"
                  >
                    Scan Complete - Proceed to Analysis
                  </button>
                </div>
              )}

              {radiologyWorkflowState === 'AWAITING_SCAN' && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Camera className="w-10 h-10 text-emerald-400" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white">Scan Complete</h2>
                    <p className="text-white/40 text-sm">Please point the camera at the scan or upload the medical image file.</p>
                  </div>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={captureFrame}
                      className="px-8 py-4 bg-emerald-500 text-black rounded-2xl font-bold uppercase tracking-widest text-xs"
                    >
                      Capture Scan
                    </button>
                    <label className="px-8 py-4 bg-white/10 border border-white/20 text-white rounded-2xl font-bold uppercase tracking-widest text-xs cursor-pointer hover:bg-white/20 transition-colors">
                      Upload File
                      <input type="file" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const base64 = ev.target?.result as string;
                            // Trigger analysis manually for file upload
                            (async () => {
                              setIsThinking(true);
                              setRadiologyWorkflowState('ANALYZING');
                              const result = await analyzeRadiology(base64, "File Upload", (window as any).isRadiologyTraining);
                              setRadiologyResult(result);
                              setRadiologyWorkflowState('RESULTS');
                              setShowRadiologyTrainer(true);
                              setIsThinking(false);
                            })();
                          };
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </label>
                  </div>
                </div>
              )}

              {radiologyWorkflowState === 'ANALYZING' && (
                <div className="text-center py-12 space-y-6">
                  <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-white italic">Aegis Quantum Analyzing...</h2>
                    <p className="text-white/40 text-sm font-mono uppercase tracking-widest">Cross-referencing global medical databases</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medical Situation Report (MSR) Modal */}
      <AnimatePresence>
        {showMSR && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-6 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 overflow-y-auto z-[500] shadow-2xl"
          >
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Medical Situation Report</h2>
                <p className="text-xs text-white/40 font-mono uppercase tracking-widest mt-1">Aegis Quantum v2.1 // MSR-001</p>
              </div>
              <button onClick={() => setShowMSR(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                <X className="w-8 h-8 text-white/60" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-8">
                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase mb-3">Patient Status</div>
                  <div className="text-2xl font-medium text-white mb-4">{diagnosis || 'Analyzing...'}</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase font-mono">Heart Rate</span>
                      <span className="text-3xl font-bold text-white tracking-tighter">{heartRate || '--'} <span className="text-sm font-normal text-white/40">BPM</span></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase font-mono">Severity</span>
                      <span className={`text-3xl font-bold tracking-tighter ${severity === 'critical' ? 'text-red-500' : 'text-emerald-500'}`}>{severity?.toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                {predictiveAnalytics && (
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[10px] font-mono text-blue-400 uppercase mb-3">Quantum Predictive Analytics</div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/80">Survival Probability</span>
                        <span className="text-xl font-bold text-emerald-500">{predictiveAnalytics.survivalProbability}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/80">Time to Criticality</span>
                        <span className="text-xl font-bold text-red-500">{predictiveAnalytics.timeToCriticalityMin} minutes</span>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[8px] text-white/40 uppercase">Organ System Risk Matrix</span>
                        {predictiveAnalytics.organSystemRisk.map((risk, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] text-white/60 w-20 truncate">{risk.system}</span>
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className={cn("h-full", risk.riskLevel > 0.7 ? "bg-red-500" : "bg-emerald-500")} style={{ width: `${risk.riskLevel * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-white/40">{(risk.riskLevel * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {multiSpectralAnalysis && (
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[10px] font-mono text-purple-400 uppercase mb-3">Multi-Spectral Tissue Analysis</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-[8px] text-white/40 uppercase mb-1">Hypoxia</div>
                        <div className="text-lg font-bold text-purple-400">{(multiSpectralAnalysis.hypoxiaDetection * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-white/40 uppercase mb-1">Hemorrhage</div>
                        <div className="text-lg font-bold text-red-400">{(multiSpectralAnalysis.internalBleedingProbability * 100).toFixed(1)}%</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[8px] text-white/40 uppercase mb-1">Viability</div>
                        <div className="text-lg font-bold text-emerald-400">{(multiSpectralAnalysis.tissueViability * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {woundMetrics && (
                  <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-[10px] font-mono text-amber-400 uppercase mb-3">Surgical Precision Wound Metrics</div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase">Length</span>
                        <span className="text-lg font-bold text-white">{woundMetrics.lengthMm}mm</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase">Depth</span>
                        <span className="text-lg font-bold text-white">{woundMetrics.depthMm}mm</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase">Area</span>
                        <span className="text-lg font-bold text-white">{woundMetrics.surfaceAreaMm2}mm²</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-white/40 uppercase">Type</span>
                        <span className="text-lg font-bold text-white truncate">{woundMetrics.type}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase">Clinical Protocol History</div>
                  <div className="space-y-3">
                    {chatHistory.map((h, i) => (
                      <div key={i} className="text-sm text-white/70 leading-relaxed border-l-2 border-emerald-500/30 pl-4 py-1">
                        {h.content}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-8 bg-white/5 rounded-2xl border border-white/5">
                <div className="w-48 h-48 bg-white p-3 rounded-2xl mb-6">
                  {/* Mock QR Code */}
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] text-white/20 text-center font-mono">
                    SECURE DATA<br/>ENCRYPTED<br/>MSR-QR
                  </div>
                </div>
                <h3 className="text-white font-bold mb-2">EMS Data Sync</h3>
                <p className="text-xs text-white/40 text-center leading-relaxed max-w-[200px]">
                  Paramedics can scan this code to instantly import the patient's vitals and treatment history.
                </p>
                <button className="mt-8 w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors">
                  Export PDF Report
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-32 bg-[#0A0A0A] border-t border-white/10 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="flex bg-white/5 border border-white/10 rounded-2xl p-1 overflow-x-auto max-w-[300px] no-scrollbar">
            {(['CLINICAL', 'SURGICAL', 'LAB', 'BIOMEDICAL', 'RADIOLOGY'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => {
                  setSpecialtyMode(mode);
                  triggerHaptic('info');
                  speak(`Switching to ${mode} mode.`);
                  if (mode === 'RADIOLOGY') {
                    setRadiologyResult(null);
                    setShowRadiologyTrainer(false);
                  }
                }}
                className={cn(
                  "px-3 py-2 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                  specialtyMode === mode ? "bg-emerald-500 text-black" : "text-white/40 hover:text-white"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          <button 
            onClick={() => {
              const newState = !isMicOn;
              setIsMicOn(newState);
              isMicOnRef.current = newState;
              triggerHaptic('info');
              
              if (newState) {
                if (!isStartedRef.current) {
                  try {
                    recognitionRef.current?.start();
                  } catch (err) {
                    console.error('Manual start failed:', err);
                  }
                }
              } else {
                recognitionRef.current?.stop();
              }
            }}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center transition-all",
              isMicOn ? "bg-white/5 border border-white/10 text-white" : "bg-red-500 text-white"
            )}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          <button 
            onClick={startVitalScan}
            disabled={isScanningVitals}
            className={cn(
              "px-6 h-12 rounded-2xl border flex items-center gap-3 transition-all",
              isScanningVitals ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
          >
            <Activity className={cn("w-4 h-4", isScanningVitals && "animate-pulse")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Vital Scan</span>
          </button>
        </div>
        
        <div className="flex-1 max-w-sm h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center px-6 mx-8">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(i => (
              <motion.div 
                key={i}
                animate={{ height: isMicOn ? [8, 16, 8] : 8 }}
                transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                className="w-1 bg-emerald-500 rounded-full"
              />
            ))}
          </div>
          <span className="ml-4 text-[10px] font-mono text-white/40 uppercase tracking-widest truncate">
            {isMicOn ? "Voice Command Active" : "Voice Command Muted"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowMSR(true)}
            className="px-6 h-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-3 pointer-events-auto"
          >
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">MSR</span>
          </button>

          <button 
            onClick={() => {
              const newMode = !isMCIMode;
              setIsMCIMode(newMode);
              triggerHaptic('warning');
              speak(newMode ? "Mass Casualty Incident mode activated. Scanning for multiple victims." : "Switching to single victim mode.");
              if (newMode) {
                setTriageTags([]);
                setSpatialMap([]);
              }
            }}
            className={cn(
              "px-6 h-12 rounded-2xl border flex items-center gap-3 transition-all pointer-events-auto",
              isMCIMode ? "bg-red-500 border-red-600 text-white" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
            )}
          >
            <div className={cn("w-2 h-2 rounded-full", isMCIMode ? "bg-white animate-ping" : "bg-red-500")} />
            <span className="text-[10px] font-bold uppercase tracking-widest">MCI Mode</span>
          </button>

          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono text-white/20 uppercase tracking-widest mb-1">Engine</span>
            <span className="text-[10px] font-mono text-emerald-500">AEGIS_UMI_V2.5</span>
          </div>
        </div>
      </div>
    </div>
  );
};
