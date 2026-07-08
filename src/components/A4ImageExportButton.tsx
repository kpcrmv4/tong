import React, { useState } from 'react';
import { Image as ImageIcon, Loader2, Printer } from 'lucide-react';
import { exportA4ToImage, printA4Element } from '../utils/a4ExportService';
import { Button } from './ui/Button';

interface A4ImageExportButtonProps {
  targetId: string;
  prefix?: string;
  isLandscape?: boolean;
  className?: string;
}

type PreparedElement = {
  element: HTMLElement;
  cleanup: () => void;
};

function prepareIframeBackedDocument(target: HTMLElement): PreparedElement {
  const iframe = target.querySelector('iframe') as HTMLIFrameElement | null;
  const iframeDoc = iframe?.contentDocument;

  if (!iframeDoc?.body) {
    return { element: target, cleanup: () => undefined };
  }

  const rect = target.getBoundingClientRect();
  const width = target.offsetWidth || Math.ceil(rect.width) || 794;
  const height = target.offsetHeight || Math.ceil(rect.height) || 1123;
  const exportRoot = document.createElement('div');

  Object.assign(exportRoot.style, {
    position: 'fixed',
    top: '0',
    left: '-10000px',
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'hidden',
    backgroundColor: 'var(--doc-card)',
    pointerEvents: 'none',
    zIndex: '-1',
    boxSizing: 'border-box',
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact'
  });

  const styleTag = document.createElement('style');
  styleTag.textContent = [
    Array.from(iframeDoc.querySelectorAll('style')).map((style) => style.textContent || '').join('\n'),
    `*{box-sizing:border-box;} body{margin:0!important;padding:0!important;background:var(--doc-card)!important;}`
  ].join('\n');
  exportRoot.appendChild(styleTag);

  Array.from(iframeDoc.body.children).forEach((child) => {
    exportRoot.appendChild(child.cloneNode(true));
  });

  document.body.appendChild(exportRoot);

  return {
    element: exportRoot,
    cleanup: () => exportRoot.remove()
  };
}

export const A4ImageExportButton: React.FC<A4ImageExportButtonProps> = ({
  targetId,
  prefix = 'DOCUMENT',
  isLandscape = false,
  className = '',
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async () => {
    const el = document.getElementById(targetId);
    if (!el) {
      setErrorMsg('ไม่พบเอกสาร');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setErrorMsg('');
    setIsExporting(true);
    const prepared = prepareIframeBackedDocument(el);
    try {
      await exportA4ToImage({ element: prepared.element, prefix, isLandscape });
    } catch (e: any) {
      setErrorMsg(e.message || 'เกิดข้อผิดพลาดในการบันทึกภาพ');
      setTimeout(() => setErrorMsg(''), 3000);
    } finally {
      prepared.cleanup();
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById(targetId);
    if (!el) {
      setErrorMsg('ไม่พบเอกสาร');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setErrorMsg('');
    const prepared = prepareIframeBackedDocument(el);
    printA4Element(prepared.element, isLandscape);
    window.setTimeout(prepared.cleanup, 1500);
  };

  return (
    <div className={`relative grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 ${className}`}>
      {errorMsg && (
        <div className="absolute -top-10 left-0 right-0 z-50 rounded-lg border border-[var(--ui-danger)] bg-[var(--ui-surface)] px-2 py-1 text-center text-xs font-bold text-[var(--ui-danger)] shadow-sm animate-in fade-in slide-in-from-bottom-2">
          โ ๏ธ {errorMsg}
        </div>
      )}
      <Button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        variant="primary"
        size="md"
        className="w-full whitespace-normal text-center"
      >
        {isExporting ? <Loader2 size={16} className="shrink-0 animate-spin" /> : <ImageIcon size={16} className="shrink-0" />}
        <span className="break-words">{isExporting ? 'กำลังสร้างภาพ...' : 'บันทึกเป็นภาพ'}</span>
      </Button>
      <Button
        type="button"
        onClick={handlePrint}
        disabled={isExporting}
        variant="secondary"
        size="md"
        className="w-full whitespace-normal text-center"
      >
        <Printer size={16} className="shrink-0 text-[var(--ui-primary)]" />
        <span className="break-words">พิมพ์เอกสาร</span>
      </Button>
    </div>
  );
};
