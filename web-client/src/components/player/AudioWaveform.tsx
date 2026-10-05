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
  barCount = 4,
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
      const barWidth = 3;
      const totalWidth = totalBars * barWidth + (totalBars - 1) * spacing;
      const startX = (width - totalWidth) / 2;

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
      }

      for (let i = 0; i < totalBars; i++) {
        let value = 0;
        if (analyser && dataArray && isSpeaking) {
          // Sample voice frequencies (human vocal fundamentals & harmonics ~85Hz - 3kHz)
          const binIndex = Math.min(
            dataArray.length - 1,
            Math.floor(((i + 1) / (totalBars + 1)) * Math.min(dataArray.length, 24))
          );
          value = dataArray[binIndex] / 255;
        } else if (isSpeaking) {
          // Synthetic subtle wave if analyser is temporarily unavailable
          value = Math.sin(Date.now() / 120 + i * 0.8) * 0.4 + 0.5;
        } else {
          // Minimal resting baseline
          value = 0.05;
        }

        const minHeight = 4;
        const maxHeight = height * 0.85;
        const barHeight = isSpeaking
          ? Math.min(maxHeight, Math.max(minHeight, value * maxHeight * 1.2))
          : minHeight;

        const x = startX + i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        // Gradient styling: soft emerald voice pulse when speaking, subtle translucent slate when idle
        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isSpeaking) {
          grad.addColorStop(0, '#34d399');
          grad.addColorStop(1, '#059669');
        } else {
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.45)');
          grad.addColorStop(1, 'rgba(100, 116, 139, 0.3)');
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
    <div className={`flex items-center justify-center px-1.5 ${className}`}>
      <canvas
        ref={canvasRef}
        width={32}
        height={24}
        className="w-[32px] h-[24px]"
      />
    </div>
  );
}
