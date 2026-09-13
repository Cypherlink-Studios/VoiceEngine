package com.voiceengine.velocity.moderation;

import java.io.File;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.logging.Level;
import java.util.logging.Logger;

public class ModerationDatabase {
    private static final Logger LOGGER = Logger.getLogger(ModerationDatabase.class.getName());

    private final String url;
    private Connection connection;

    public ModerationDatabase(File dbFile) {
        if (!dbFile.getParentFile().exists()) {
            dbFile.getParentFile().mkdirs();
        }
        this.url = "jdbc:sqlite:" + dbFile.getAbsolutePath();
    }

    public synchronized void init() throws SQLException {
        this.connection = DriverManager.getConnection(url);

        try (Statement stmt = connection.createStatement()) {
            stmt.execute("PRAGMA journal_mode=WAL;");
            stmt.execute("""
                CREATE TABLE IF NOT EXISTS punishments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_uuid TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    client_ip TEXT,
                    device_id TEXT,
                    punishment_type TEXT NOT NULL,
                    reason TEXT,
                    staff_uuid TEXT,
                    staff_name TEXT,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER,
                    revoked INTEGER DEFAULT 0
                );
            """);
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_active_uuid ON punishments (player_uuid, punishment_type, revoked);");
            stmt.execute("CREATE INDEX IF NOT EXISTS idx_active_ip ON punishments (client_ip, punishment_type, revoked);");
        }
        LOGGER.info("[VoiceEngine] Moderation SQLite database initialized successfully.");
    }

    private Connection getConnection() throws SQLException {
        if (connection == null || connection.isClosed()) {
            connection = DriverManager.getConnection(url);
        }
        return connection;
    }

    public synchronized PunishmentRecord addPunishment(
        UUID playerUuid,
        String playerName,
        String clientIp,
        String deviceId,
        PunishmentType type,
        String reason,
        UUID staffUuid,
        String staffName,
        Long expiresAt
    ) throws SQLException {
        // Automatically revoke any existing active punishment of the same type for this player
        revokePunishment(playerUuid, type);

        String sql = """
            INSERT INTO punishments (
                player_uuid, player_name, client_ip, device_id, punishment_type,
                reason, staff_uuid, staff_name, created_at, expires_at, revoked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """;

        long now = System.currentTimeMillis();
        try (PreparedStatement ps = getConnection().prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, playerUuid.toString());
            ps.setString(2, playerName != null ? playerName : "Unknown");
            ps.setString(3, clientIp);
            ps.setString(4, deviceId);
            ps.setString(5, type.name());
            ps.setString(6, reason != null ? reason : "No reason provided");
            ps.setString(7, staffUuid != null ? staffUuid.toString() : null);
            ps.setString(8, staffName != null ? staffName : "Console");
            ps.setLong(9, now);
            if (expiresAt != null && expiresAt > 0) {
                ps.setLong(10, expiresAt);
            } else {
                ps.setNull(10, Types.INTEGER);
            }
            ps.executeUpdate();

            long id = 0;
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    id = rs.getLong(1);
                }
            }

            return new PunishmentRecord(
                id, playerUuid, playerName, clientIp, deviceId, type,
                reason, staffUuid, staffName, now, expiresAt, false
            );
        }
    }

    public synchronized boolean revokePunishment(UUID playerUuid, PunishmentType type) throws SQLException {
        String sql = "UPDATE punishments SET revoked = 1 WHERE player_uuid = ? AND punishment_type = ? AND revoked = 0";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setString(2, type.name());
            int updated = ps.executeUpdate();
            return updated > 0;
        }
    }

    public synchronized Optional<PunishmentRecord> getActivePunishment(UUID playerUuid, PunishmentType type) {
        String sql = """
            SELECT id, player_uuid, player_name, client_ip, device_id, punishment_type,
                   reason, staff_uuid, staff_name, created_at, expires_at, revoked
            FROM punishments
            WHERE player_uuid = ? AND punishment_type = ? AND revoked = 0
            ORDER BY created_at DESC LIMIT 1
        """;

        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            ps.setString(2, type.name());
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    PunishmentRecord record = mapRecord(rs);
                    if (record.isActive()) {
                        return Optional.of(record);
                    }
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Error querying active punishment: " + e.getMessage(), e);
        }
        return Optional.empty();
    }

    public synchronized List<PunishmentRecord> getAllActivePunishments(UUID playerUuid) {
        List<PunishmentRecord> records = new ArrayList<>();
        String sql = """
            SELECT id, player_uuid, player_name, client_ip, device_id, punishment_type,
                   reason, staff_uuid, staff_name, created_at, expires_at, revoked
            FROM punishments
            WHERE player_uuid = ? AND revoked = 0
            ORDER BY created_at DESC
        """;

        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, playerUuid.toString());
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    PunishmentRecord record = mapRecord(rs);
                    if (record.isActive()) {
                        records.add(record);
                    }
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Error querying all active punishments: " + e.getMessage(), e);
        }
        return records;
    }

    public synchronized List<PunishmentRecord> getAllActivePunishments() {
        List<PunishmentRecord> records = new ArrayList<>();
        String sql = """
            SELECT id, player_uuid, player_name, client_ip, device_id, punishment_type,
                   reason, staff_uuid, staff_name, created_at, expires_at, revoked
            FROM punishments
            WHERE revoked = 0
            ORDER BY created_at DESC
        """;

        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    PunishmentRecord record = mapRecord(rs);
                    if (record.isActive()) {
                        records.add(record);
                    }
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Error querying active punishments batch: " + e.getMessage(), e);
        }
        return records;
    }

    public synchronized boolean isIpBanned(String ip) {
        if (ip == null || ip.isBlank()) return false;
        String sql = "SELECT expires_at, revoked FROM punishments WHERE client_ip = ? AND punishment_type = 'BAN' AND revoked = 0";
        try (PreparedStatement ps = getConnection().prepareStatement(sql)) {
            ps.setString(1, ip);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long expiresAt = rs.getLong("expires_at");
                    if (rs.wasNull() || expiresAt <= 0 || System.currentTimeMillis() < expiresAt) {
                        return true;
                    }
                }
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Error checking IP ban: " + e.getMessage(), e);
        }
        return false;
    }

    private PunishmentRecord mapRecord(ResultSet rs) throws SQLException {
        long id = rs.getLong("id");
        UUID playerUuid = UUID.fromString(rs.getString("player_uuid"));
        String playerName = rs.getString("player_name");
        String clientIp = rs.getString("client_ip");
        String deviceId = rs.getString("device_id");
        PunishmentType type = PunishmentType.valueOf(rs.getString("punishment_type"));
        String reason = rs.getString("reason");
        String staffUuidStr = rs.getString("staff_uuid");
        UUID staffUuid = staffUuidStr != null ? UUID.fromString(staffUuidStr) : null;
        String staffName = rs.getString("staff_name");
        long createdAt = rs.getLong("created_at");
        long expiresAtVal = rs.getLong("expires_at");
        Long expiresAt = rs.wasNull() ? null : expiresAtVal;
        boolean revoked = rs.getInt("revoked") == 1;

        return new PunishmentRecord(
            id, playerUuid, playerName, clientIp, deviceId, type,
            reason, staffUuid, staffName, createdAt, expiresAt, revoked
        );
    }

    public synchronized void close() {
        if (connection != null) {
            try {
                connection.close();
            } catch (SQLException ignored) {}
        }
    }
}
