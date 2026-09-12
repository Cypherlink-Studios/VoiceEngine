package com.voiceengine.service;

public interface VoiceEngineService {
    default void start() {}
    default void stop() {}
    default void reload() {}
}
