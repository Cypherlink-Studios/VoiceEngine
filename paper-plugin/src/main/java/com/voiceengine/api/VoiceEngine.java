package com.voiceengine.api;

import org.bukkit.Bukkit;

public final class VoiceEngine {
    private static VoiceEngineAPI api;

    private VoiceEngine() {}

    public static VoiceEngineAPI getApi() {
        if (api == null) {
            var registration = Bukkit.getServicesManager().getRegistration(VoiceEngineAPI.class);
            if (registration != null) {
                api = registration.getProvider();
            }
        }
        return api;
    }

    public static void setApi(VoiceEngineAPI apiInstance) {
        api = apiInstance;
    }
}
