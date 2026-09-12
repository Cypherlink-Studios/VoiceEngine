import React, { createContext, useContext, useEffect, useState } from 'react';

export interface PublicBranding {
  serverName: string;
  tagline: string;
  logoUrl: string;
  backgroundUrl: string;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
}

export interface PublicVoiceConfig {
  maxSlots: number;
  maxVoiceDistance: number;
  sneakVoiceDistance: number;
  defaultBitrate: number;
}

export interface PublicFixedChannel {
  id: string;
  name: string;
  description: string;
  userLimit: number;
  isDefault?: boolean;
}

export interface PublicConfig {
  branding: PublicBranding;
  voice: PublicVoiceConfig;
  maxSlots: number;
  fixedChannels: PublicFixedChannel[];
}

const DEFAULT_CONFIG: PublicConfig = {
  branding: {
    serverName: 'VoiceEngine Server',
    tagline: 'Zero-Mod Proximity Voice Chat',
    logoUrl: '',
    backgroundUrl: '',
    primaryColor: '#6366f1',
    accentColor: '#22c55e',
    welcomeMessage: 'Welcome to VoiceEngine! Proximity voice is active.',
  },
  voice: {
    maxSlots: 100,
    maxVoiceDistance: 30.0,
    sneakVoiceDistance: 8.0,
    defaultBitrate: 64000,
  },
  maxSlots: 100,
  fixedChannels: [
    {
      id: 'lobby',
      name: 'General Lobby',
      description: 'Global voice room without 3D distance',
      userLimit: 0,
      isDefault: true,
    },
  ],
};

interface BrandContextType {
  config: PublicConfig;
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType>({
  config: DEFAULT_CONFIG,
  loading: false,
  refreshConfig: async () => {},
});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const applyTheme = (branding: PublicBranding) => {
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', branding.primaryColor);
    root.style.setProperty('--brand-accent', branding.accentColor);
    document.title = branding.serverName ? `${branding.serverName} | VoiceEngine` : 'VoiceEngine';
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config/public');
      if (res.ok) {
        const data: PublicConfig = await res.json();
        setConfig(data);
        applyTheme(data.branding);
      }
    } catch {
      // Keep default configuration if offline or mock testing
      applyTheme(DEFAULT_CONFIG.branding);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <BrandContext.Provider value={{ config, loading, refreshConfig: fetchConfig }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
