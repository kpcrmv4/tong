import React, { useRef, useEffect, useState } from "react";

export interface A4PageContainerProps {
  children: React.ReactNode;
  isLandscape?: boolean;
  className?: string; // Additional classes for the internal A4 wrapper
  scaleToFit?: boolean;
  id?: string;
  paperSize?: "A4" | "A5";
}

export const A4PageContainer: React.FC<A4PageContainerProps> = ({
  children,
  isLandscape = false,
  className = "",
  scaleToFit = true,
  id,
  paperSize = "A4",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const a4WidthMm =
    paperSize === "A5" ? (isLandscape ? 210 : 148) : isLandscape ? 297 : 210;

  const a4HeightMm =
    paperSize === "A5" ? (isLandscape ? 148 : 210) : isLandscape ? 210 : 297;

  useEffect(() => {
    if (!scaleToFit) {
      setScale(1);
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parentWidth = entry.contentRect.width;

        // 1mm ~ 3.78px for standard 96dpi web rendering
        const targetPxWidth =
          paperSize === "A5"
            ? isLandscape
              ? 794
              : 559
            : isLandscape
              ? 1123
              : 794;

        // Add some padding inside the parent
        const maxAvailableWidth = parentWidth - 32;

        if (maxAvailableWidth < targetPxWidth) {
          setScale(maxAvailableWidth / targetPxWidth);
        } else {
          setScale(1);
        }
      }
    });

    if (containerRef.current && containerRef.current.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, [isLandscape, scaleToFit, paperSize]);

  return (
    <div
      className={`flex justify-center items-start w-full origin-top select-text ${
        scaleToFit ? "overflow-hidden" : "overflow-visible"
      }`}
      ref={containerRef}
      style={{
        height: scaleToFit ? `calc(${a4HeightMm}mm * ${scale})` : undefined,
        transition: "height 0.2s ease-out",
      }}
    >
      <div
        className={`${
          id === "live-receipt-preview"
            ? "overflow-hidden"
            : scaleToFit
              ? "ai-panel shadow-lg overflow-hidden"
              : "overflow-visible"
        } shrink-0 origin-top relative ${className}`}
        style={{
          width: `${a4WidthMm}mm`,
          height: `${a4HeightMm}mm`,
          transform: scaleToFit ? `scale(${scale})` : "none",
          boxSizing: "border-box",
          pageBreakAfter: "always",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
        }}
      >
        {children}
      </div>
    </div>
  );
};
