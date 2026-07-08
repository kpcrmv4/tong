import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';

interface SignaturePadProps {
  value?: string;
  onChange: (base64Data: string) => void;
  label?: string;
  placeholder?: string;
}

export default function SignaturePad({ value, onChange, label, placeholder }: SignaturePadProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  
  // Keep track of original signature to restore on resize
  const signatureBackupRef = useRef<string | null>(null);

  // Sync state when value changes externally
  useEffect(() => {
    if (value && value.startsWith('data:image')) {
      setHasSigned(true);
      signatureBackupRef.current = value;
      drawSavedImage(value);
    } else if (!value) {
      setHasSigned(false);
      signatureBackupRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [value]);

  const drawSavedImage = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw signature centered and fitting the canvas size
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  };

  // Setup ResizeObserver for absolute stability on container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const canvas = canvasRef.current;
        if (!canvas) continue;

        // Get actual display size
        const width = Math.floor(entry.contentRect.width);
        const height = 140; // Maintain a stable height of 140px

        // Only resize if different to prevent infinite loops
        if (canvas.width !== width || canvas.height !== height) {
          // Cache existing content to restore it after resize
          let cachedDataUrl: string | null = null;
          if (hasSigned) {
            cachedDataUrl = canvas.toDataURL('image/png');
          } else if (signatureBackupRef.current) {
            cachedDataUrl = signatureBackupRef.current;
          }

          // Set canvas resolution strictly equal to CSS display dimensions
          canvas.width = width;
          canvas.height = height;

          // Restore content
          if (cachedDataUrl) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const img = new Image();
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              };
              img.src = cachedDataUrl;
            }
          }
        }
      }
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, [hasSigned]);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || 'var(--doc-text)'; // theme ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pos = getEventPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getEventPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignature();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (hasSigned) {
      const dataUrl = canvas.toDataURL('image/png');
      signatureBackupRef.current = dataUrl;
      onChange(dataUrl);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    signatureBackupRef.current = null;
    onChange('');
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between items-center select-none">
          <label className="block text-xs font-extrabold text-[var(--ui-text)] uppercase tracking-wide">
            {label}
          </label>
          {hasSigned && (
            <span className="text-[10px] text-[var(--ui-primary)] font-extrabold flex items-center gap-1">
              <ShieldCheck size={12} className="text-[var(--ui-primary)]" />
              ลายเซ็นได้รับการบันทึก
            </span>
          )}
        </div>
      )}
      
      <div 
        ref={containerRef}
        className="relative border border-[var(--ui-border)] ai-panel rounded-xl overflow-hidden hover:border-[var(--ui-border)] transition-colors shadow-inner"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="w-full h-[140px] cursor-crosshair ai-panel block"
          style={{ touchAction: 'none' }}
        />
        
        {!hasSigned && placeholder && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-center text-[11px] text-[var(--text-soft)] font-medium px-6 leading-relaxed">
            {placeholder}
          </div>
        )}
        
        {hasSigned && (
          <Button
            type="button"
            onClick={clearSignature}
            className="absolute bottom-2 right-2 p-1.5 px-2 bg-[var(--ui-surface)] hover:bg-[var(--ui-danger)] border border-[var(--ui-border)] text-[var(--ui-warning)] rounded-lg flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
          >
            <RotateCcw size={10} />
            <span>ล้างลายเซ็น</span>
          </Button>
        )}
      </div>
    </div>
  );
}
