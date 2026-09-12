import { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  analyser: AnalyserNode | null;
  isSpeaking: boolean;
  barCount?: number;
  className?: string;
}

export function AudioWaveform({
  analyser,
  isSpeaking,
  barCount = 18,
  className = '',
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const totalBars = barCount;
      const spacing = 3;
      const barWidth = Math.max(2, (width - (totalBars - 1) * spacing) / totalBars);

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      // Read CSS variable for brand accent color, or fallback to neon green
      const computedStyle = getComputedStyle(document.documentElement);
      const accentColor = computedStyle.getPropertyValue('--brand-accent').trim() || '#22c55e';
      const primaryColor = computedStyle.getPropertyValue('--brand-primary').trim() || '#6366f1';

      for (let i = 0; i < totalBars; i++) {
        let value = 0;
        if (analyser && dataArray) {
          // Sample linearly across frequency spectrum
          const binIndex = Math.min(
            dataArray.length - 1,
            Math.floor((i / totalBars) * Math.min(dataArray.length, 32))
          );
          value = dataArray[binIndex] / 255;
        } else if (isSpeaking) {
          // Synthetic wave pulse if analyser is null
          value = Math.sin(Date.now() / 150 + i * 0.5) * 0.4 + 0.5;
        } else {
          // Subtle idle noise
          value = 0.08 + Math.sin(Date.now() / 400 + i * 0.3) * 0.04;
        }

        const minHeight = 4;
        const barHeight = Math.max(minHeight, value * height * 0.9);
        const x = i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        // Gradient styling
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSpeaking) {
          grad.addColorStop(0, accentColor);
          grad.addColorStop(1, primaryColor);
        } else {
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.4)');
          grad.addColorStop(1, 'rgba(71, 85, 105, 0.2)');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = barWidth / 2;
        ctx.roundRect(x, y, barWidth, barHeight, radius);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser, isSpeaking, barCount]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={140}
        height={36}
        className="w-[140px] h-[36px]"
      />
    </div>
  );
}
