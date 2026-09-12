package com.voiceengine.api;

import com.voiceengine.auth.SessionToken;
import com.voiceengine.auth.TokenManager;
import com.voiceengine.net.VoiceBackendClient;
import com.voiceengine.visual.SpeechFeedbackHandler;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

public class VoiceEngineAPIImpl implements VoiceEngineAPI {
    private final TokenManager tokenManager;
    private final SpeechFeedbackHandler speechFeedbackHandler;
    private final Supplier<VoiceBackendClient> clientSupplier;

    public VoiceEngineAPIImpl(
        TokenManager tokenManager,
        SpeechFeedbackHandler speechFeedbackHandler,
        Supplier<VoiceBackendClient> clientSupplier
    ) {
        this.tokenManager = tokenManager;
        this.speechFeedbackHandler = speechFeedbackHandler;
        this.clientSupplier = clientSupplier;
    }

    @Override
    public boolean isConnected(UUID playerUuid) {
        return (speechFeedbackHandler != null && speechFeedbackHandler.isSpeaking(playerUuid))
            || (tokenManager != null && tokenManager.getToken(playerUuid).isPresent());
    }

    @Override
    public boolean isSpeaking(UUID playerUuid) {
        return speechFeedbackHandler != null && speechFeedbackHandler.isSpeaking(playerUuid);
    }

    @Override
    public Optional<SessionToken> getActiveToken(UUID playerUuid) {
        return tokenManager != null ? tokenManager.getToken(playerUuid) : Optional.empty();
    }

    @Override
    public boolean isBackendConnected() {
        VoiceBackendClient client = clientSupplier != null ? clientSupplier.get() : null;
        return client != null && client.isOpen();
    }
}
