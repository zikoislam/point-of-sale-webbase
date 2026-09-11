'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeRendererProps {
  value: string;
  width?: number;
  height?: number;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'CODE39';
  className?: string;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  width = 1.4,
  height = 32,
  format = 'CODE128',
  className,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      JsBarcode(svgRef.current, String(value), {
        format,
        width,
        height,
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#000000',
      });
    } catch (e) {
      // If code cannot be rendered (e.g. invalid EAN13 checksum), try CODE128 fallback
      try {
        JsBarcode(svgRef.current, String(value), {
          format: 'CODE128',
          width,
          height,
          displayValue: false,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
      } catch {
        // Silent catch
      }
    }
  }, [value, width, height, format]);

  return <svg ref={svgRef} className={className} />;
};
