package com.voiceengine.service;

import com.voiceengine.visual.SpeechFeedbackHandler;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;
import org.bukkit.scheduler.BukkitTask;

public class VisualFeedbackService implements VoiceEngineService {
    private final Plugin plugin;
    private final SpeechFeedbackHandler feedbackHandler;
    private BukkitTask task;

    public VisualFeedbackService(Plugin plugin, SpeechFeedbackHandler feedbackHandler) {
        this.plugin = plugin;
        this.feedbackHandler = feedbackHandler;
    }

    @Override
    public void start() {
        if (task != null) {
            task.cancel();
        }
        this.task = Bukkit.getScheduler().runTaskTimer(plugin, feedbackHandler::renderVisualIndicators, 5L, 5L);
    }

    @Override
    public void stop() {
        if (task != null) {
            task.cancel();
            task = null;
        }
        if (feedbackHandler != null) {
            feedbackHandler.clear();
        }
    }

    @Override
    public void reload() {
        // Clear speech states on reload
        if (feedbackHandler != null) {
            feedbackHandler.clear();
        }
    }

    public boolean isRunning() {
        return task != null && !task.isCancelled();
    }
}
