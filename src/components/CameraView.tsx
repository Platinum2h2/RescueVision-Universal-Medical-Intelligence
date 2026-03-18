import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Zap, ZapOff } from 'lucide-react';
import { cn } from '../lib/utils';

interface CameraViewProps {
  onCapture: (image: string) => void;
  label: string;
  description: string;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, label, description }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = useCallback(async () => {
    try {
      // Stop existing tracks before starting new ones
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsReady(true);
      }
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions.');
      console.error(err);
    }
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center overflow-hidden">
      {error ? (
        <div className="text-white text-center p-6">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={startCamera}
            className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className={cn(
              "absolute inset-0 w-full h-full object-cover opacity-80",
              facingMode === 'user' && "-scale-x-100"
            )}
          />
          
          {/* Hardware-style UI Overlay */}
          <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
            <div className="w-full h-full border border-white/20 relative">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60" />
              
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-6 px-8">
            <div className="text-center">
              <h2 className="text-white font-mono text-xs tracking-[0.2em] uppercase mb-1">{label}</h2>
              <p className="text-white/60 text-[10px] uppercase tracking-wider">{description}</p>
            </div>
            
            <button
              onClick={capture}
              disabled={!isReady}
              className={cn(
                "w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center transition-all active:scale-95",
                isReady ? "bg-white/10 hover:bg-white/20" : "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="w-14 h-14 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
            </button>
          </div>

          {/* Top Status */}
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-mono text-[10px] tracking-widest uppercase">REC: LIVE_FEED</span>
              </div>
              <span className="text-white/40 font-mono text-[9px]">ISO 400 | 1/60 | F2.8</span>
            </div>
            <div className="flex gap-4">
              <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Zap className="w-4 h-4 text-white/40" />
              </button>
              <button 
                onClick={toggleCamera}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Flip Camera"
              >
                <RefreshCw className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
