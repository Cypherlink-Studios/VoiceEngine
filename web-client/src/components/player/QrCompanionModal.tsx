import React, { useEffect, useState } from 'react';
import { X, Smartphone, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import QRCode from 'qrcode';

export interface QrCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionUrl: string;
  streamerMode: boolean;
}

export const QrCompanionModal: React.FC<QrCompanionModalProps> = ({
  isOpen,
  onClose,
  sessionUrl,
  streamerMode,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [revealInStreamerMode, setRevealInStreamerMode] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !sessionUrl) return;
    setRevealInStreamerMode(false);

    QRCode.toDataURL(sessionUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.error('[QrCompanionModal] Failed to generate QR:', err);
      });
  }, [isOpen, sessionUrl]);

  if (!isOpen) return null;

  const isMasked = streamerMode && !revealInStreamerMode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-white/15 shadow-2xl overflow-hidden text-slate-100 p-6 flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-1 text-emerald-400">
          <Smartphone className="w-6 h-6" />
          <h2 className="text-lg font-bold text-white">Consola Móvil</h2>
        </div>
        <p className="text-xs text-slate-400 text-center mb-5 max-w-[280px]">
          Escanea este código con tu teléfono o tablet para usarlo como panel de voz táctil en tu escritorio.
        </p>

        {/* QR Code Container */}
        <div className="relative w-64 h-64 bg-white rounded-2xl p-3 shadow-inner flex items-center justify-center">
          {isMasked ? (
            <div className="flex flex-col items-center justify-center p-4 text-center bg-slate-950 rounded-xl w-full h-full border border-white/10">
              <EyeOff className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs font-semibold text-slate-200 mb-1">Modo Streamer Activo</p>
              <p className="text-[11px] text-slate-400 mb-3">El código QR contiene tu token de sesión.</p>
              <button
                onClick={() => setRevealInStreamerMode(true)}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Mostrar QR</span>
              </button>
            </div>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR for VoiceEngine Companion"
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <div className="flex items-center justify-center text-slate-500 text-xs animate-pulse">
              Generando código QR...
            </div>
          )}
        </div>

        {/* Perks list */}
        <div className="mt-5 w-full bg-slate-950/60 border border-white/10 rounded-xl p-3 text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Sin descargas ni apps: corre en el navegador móvil.</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Mantiene la pantalla encendida automáticamente.</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Vibración háptica al mutear o cambiar de canal.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
