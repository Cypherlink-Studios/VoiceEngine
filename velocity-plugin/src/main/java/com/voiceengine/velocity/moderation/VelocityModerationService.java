package com.voiceengine.velocity.moderation;

import com.voiceengine.velocity.net.VelocityBackendClient;
import org.slf4j.Logger;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

public class VelocityModerationService {
    private final ModerationDatabase database;
    private final Supplier<VelocityBackendClient> clientSupplier;
    private final Logger logger;

    public VelocityModerationService(
        ModerationDatabase database,
        Supplier<VelocityBackendClient> clientSupplier,
        Logger logger
    ) {
        this.database = database;
        this.clientSupplier = clientSupplier;
        this.logger = logger;
    }

    public boolean kickPlayer(UUID targetUuid, String reason) {
        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "kick", true, reason, null, null);
            return true;
        }
        return false;
    }

    public PunishmentRecord mutePlayer(
        UUID targetUuid,
        String targetName,
        String clientIp,
        UUID staffUuid,
        String staffName,
        Long expiresAt,
        String reason
    ) throws SQLException {
        PunishmentRecord record = database.addPunishment(
            targetUuid, targetName, clientIp, null, PunishmentType.MUTE,
            reason, staffUuid, staffName, expiresAt
        );

        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "mute", true, reason, expiresAt, null);
        }
        return record;
    }

    public PunishmentRecord deafenPlayer(
        UUID targetUuid,
        String targetName,
        String clientIp,
        UUID staffUuid,
        String staffName,
        Long expiresAt,
        String reason
    ) throws SQLException {
        PunishmentRecord record = database.addPunishment(
            targetUuid, targetName, clientIp, null, PunishmentType.DEAFEN,
            reason, staffUuid, staffName, expiresAt
        );

        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "deafen", true, reason, expiresAt, null);
        }
        return record;
    }

    public PunishmentRecord banPlayer(
        UUID targetUuid,
        String targetName,
        String clientIp,
        UUID staffUuid,
        String staffName,
        Long expiresAt,
        String reason
    ) throws SQLException {
        PunishmentRecord record = database.addPunishment(
            targetUuid, targetName, clientIp, null, PunishmentType.BAN,
            reason, staffUuid, staffName, expiresAt
        );

        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "ban", true, reason, expiresAt, clientIp);
        }
        return record;
    }

    public boolean unmutePlayer(UUID targetUuid) throws SQLException {
        boolean revoked = database.revokePunishment(targetUuid, PunishmentType.MUTE);
        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "mute", false, null, null, null);
        }
        return revoked;
    }

    public boolean undeafenPlayer(UUID targetUuid) throws SQLException {
        boolean revoked = database.revokePunishment(targetUuid, PunishmentType.DEAFEN);
        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "deafen", false, null, null, null);
        }
        return revoked;
    }

    public boolean unbanPlayer(UUID targetUuid) throws SQLException {
        boolean revoked = database.revokePunishment(targetUuid, PunishmentType.BAN);
        VelocityBackendClient client = clientSupplier.get();
        if (client != null && client.isOpen()) {
            client.sendModerationAction(targetUuid, "ban", false, null, null, null);
        }
        return revoked;
    }

    public Optional<PunishmentRecord> getActiveBan(UUID targetUuid) {
        return database.getActivePunishment(targetUuid, PunishmentType.BAN);
    }

    public Optional<PunishmentRecord> getActiveMute(UUID targetUuid) {
        return database.getActivePunishment(targetUuid, PunishmentType.MUTE);
    }

    public Optional<PunishmentRecord> getActiveDeafen(UUID targetUuid) {
        return database.getActivePunishment(targetUuid, PunishmentType.DEAFEN);
    }

    public List<PunishmentRecord> getAllActive(UUID targetUuid) {
        return database.getAllActivePunishments(targetUuid);
    }

    public boolean isIpBanned(String ip) {
        return database.isIpBanned(ip);
    }

    public void syncToBackend(VelocityBackendClient client) {
        if (client != null && client.isOpen()) {
            List<PunishmentRecord> active = database.getAllActivePunishments();
            client.sendActivePunishmentsSync(active);
            if (logger != null) {
                logger.info("[VoiceEngine] Synchronized {} active punishments to voice backend.", active.size());
            }
        }
    }
}
