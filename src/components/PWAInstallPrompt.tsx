import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from './ui/Button';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isPwa = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    setIsStandalone(isPwa);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    if (isIosDevice && !isPwa) {
      // Show iOS instructions after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt || isStandalone) return null;

  // ปิดการแสดงป๊อปอัป "ติดตั้งแอปลงบนมือถือ" ถาวรตามคำสั่ง
  return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-500 max-w-sm mx-auto">
      <div className="ai-panel rounded-2xl shadow-[var(--ui-shadow-soft)] p-4 border border-[var(--ui-border)] flex items-start gap-4">
        <div className="ai-panel p-3 rounded-xl flex-shrink-0 text-[var(--text-main)]">
          <Download className="w-6 h-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[var(--text-soft)] text-sm mb-1">ติดตั้งแอปลงบนมือถือ</h3>
          <p className="text-xs text-[var(--text-soft)] mb-3 leading-relaxed">
            {isIOS 
              ? 'แตะปุ่ม Share "แชร์" ด้านล่าง แล้วเลือก "เพิ่มไปยังหน้าจอโฮม" เพื่อการใช้งานที่เต็มจอ' 
              : 'ติดตั้งแอปลงในเครื่องเพื่อการใช้งานที่รวดเร็วและเต็มจอเหมือนแอปพลิเคชันปกติ'
            }
          </p>
          
          {!isIOS && deferredPrompt && (
            <Button 
              onClick={handleInstallClick}
              className="w-full outer-cont text-[var(--text-main)]  font-bold py-2 rounded-xl text-xs transition-colors shadow-md shadow-[0_18px_45px_color-mix(in_srgb,var(--ui-danger)_18%,transparent)]"
            >
              ติดตั้งด่วน
            </Button>
          )}
        </div>
        
        <Button 
          onClick={() => setShowPrompt(false)}
          className="flex-shrink-0 text-[var(--text-soft)] hover:text-[var(--text-soft)] p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
