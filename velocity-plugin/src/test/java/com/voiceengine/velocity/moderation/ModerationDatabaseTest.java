package com.voiceengine.velocity.moderation;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class ModerationDatabaseTest {

    @TempDir
    Path tempDir;

    private ModerationDatabase database;

    @BeforeEach
    void setUp() throws SQLException {
        File dbFile = tempDir.resolve("moderation.db").toFile();
        database = new ModerationDatabase(dbFile);
        database.init();
    }

    @AfterEach
    void tearDown() {
        if (database != null) {
            database.close();
        }
    }

    @Test
    void testAddAndRetrieveActiveMute() throws SQLException {
        UUID playerUuid = UUID.randomUUID();
        UUID staffUuid = UUID.randomUUID();
        long expiresAt = System.currentTimeMillis() + 60_000;

        PunishmentRecord created = database.addPunishment(
            playerUuid, "Bob", "192.168.1.50", "device-abc",
            PunishmentType.MUTE, "Spamming mic", staffUuid, "AdminAlice", expiresAt
        );

        assertNotNull(created);
        assertEquals(playerUuid, created.playerUuid());
        assertEquals("Bob", created.playerName());
        assertEquals(PunishmentType.MUTE, created.punishmentType());
        assertTrue(created.isActive());

        Optional<PunishmentRecord> fetched = database.getActivePunishment(playerUuid, PunishmentType.MUTE);
        assertTrue(fetched.isPresent());
        assertEquals("Spamming mic", fetched.get().reason());
        assertEquals("AdminAlice", fetched.get().staffName());
    }

    @Test
    void testRevokePunishment() throws SQLException {
        UUID playerUuid = UUID.randomUUID();
        database.addPunishment(
            playerUuid, "Bob", "192.168.1.50", null,
            PunishmentType.DEAFEN, "Trolling", null, "Console", null
        );

        assertTrue(database.getActivePunishment(playerUuid, PunishmentType.DEAFEN).isPresent());

        boolean revoked = database.revokePunishment(playerUuid, PunishmentType.DEAFEN);
        assertTrue(revoked);

        Optional<PunishmentRecord> fetchedAfter = database.getActivePunishment(playerUuid, PunishmentType.DEAFEN);
        assertTrue(fetchedAfter.isEmpty());
    }

    @Test
    void testIpBanDetection() throws SQLException {
        UUID playerUuid = UUID.randomUUID();
        String ip = "203.0.113.10";

        assertFalse(database.isIpBanned(ip));

        database.addPunishment(
            playerUuid, "BadActor", ip, null,
            PunishmentType.BAN, "Toxicity", null, "Staff", null
        );

        assertTrue(database.isIpBanned(ip));
        assertFalse(database.isIpBanned("1.1.1.1"));

        database.revokePunishment(playerUuid, PunishmentType.BAN);
        assertFalse(database.isIpBanned(ip));
    }

    @Test
    void testExpiredPunishmentIgnored() throws SQLException {
        UUID playerUuid = UUID.randomUUID();
        long expiredTime = System.currentTimeMillis() - 10_000; // 10s ago

        database.addPunishment(
            playerUuid, "Test", "127.0.0.1", null,
            PunishmentType.MUTE, "Short mute", null, "Staff", expiredTime
        );

        Optional<PunishmentRecord> active = database.getActivePunishment(playerUuid, PunishmentType.MUTE);
        assertTrue(active.isEmpty());
    }

    @Test
    void testMultipleActivePunishments() throws SQLException {
        UUID playerUuid = UUID.randomUUID();

        database.addPunishment(playerUuid, "Multi", "10.0.0.1", null, PunishmentType.MUTE, "Reason 1", null, "Console", null);
        database.addPunishment(playerUuid, "Multi", "10.0.0.1", null, PunishmentType.DEAFEN, "Reason 2", null, "Console", null);

        List<PunishmentRecord> active = database.getAllActivePunishments(playerUuid);
        assertEquals(2, active.size());

        List<PunishmentRecord> all = database.getAllActivePunishments();
        assertTrue(all.size() >= 2);
    }
}
