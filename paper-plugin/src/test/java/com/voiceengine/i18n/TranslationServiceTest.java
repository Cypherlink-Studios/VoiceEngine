package com.voiceengine.i18n;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.StringReader;
import java.nio.file.Path;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

class TranslationServiceTest {
    private TranslationService translationService;

    @BeforeEach
    void setUp() {
        translationService = new TranslationService();
    }

    @Test
    void testExactLocaleAndFallback() {
        YamlConfiguration en = YamlConfiguration.loadConfiguration(new StringReader(
            "prefix: '[VE] '\n" +
            "test: '<prefix>Hello <name>!'\n" +
            "only_en: '<prefix>Only English'\n"
        ));
        YamlConfiguration es = YamlConfiguration.loadConfiguration(new StringReader(
            "prefix: '[VE] '\n" +
            "test: '<prefix>¡Hola <name>!'\n"
        ));

        translationService.registerLocale("en_us", en);
        translationService.registerLocale("es_es", es);

        // 1. Exact match Spanish
        Component compEs = translationService.render(Locale.forLanguageTag("es-ES"), "test", Placeholder.parsed("name", "Steve"));
        String textEs = PlainTextComponentSerializer.plainText().serialize(compEs);
        assertEquals("[VE] ¡Hola Steve!", textEs);

        // 2. Exact match English
        Component compEn = translationService.render(Locale.US, "test", Placeholder.parsed("name", "Alex"));
        String textEn = PlainTextComponentSerializer.plainText().serialize(compEn);
        assertEquals("[VE] Hello Alex!", textEn);

        // 3. Fallback when locale is French (fr_FR) -> falls back to default en_us
        Component compFr = translationService.render(Locale.FRANCE, "test", Placeholder.parsed("name", "Pierre"));
        String textFr = PlainTextComponentSerializer.plainText().serialize(compFr);
        assertEquals("[VE] Hello Pierre!", textFr);

        // 4. Fallback for key missing in Spanish -> falls back to English
        Component compMissingInEs = translationService.render(Locale.forLanguageTag("es-ES"), "only_en");
        String textMissingInEs = PlainTextComponentSerializer.plainText().serialize(compMissingInEs);
        assertEquals("[VE] Only English", textMissingInEs);
    }

    @Test
    void testLoadFromDiskAndBundledResources(@TempDir Path tempDir) {
        File dataFolder = tempDir.toFile();
        translationService.load(dataFolder, "en_US");

        // Verify bundled files were extracted
        File langDir = new File(dataFolder, "lang");
        assertTrue(langDir.exists());
        assertTrue(new File(langDir, "messages_en_US.yml").exists());
        assertTrue(new File(langDir, "messages_es_ES.yml").exists());

        // Verify rendering from bundled content
        Component compEn = translationService.render(Locale.US, "notification.join");
        String textEn = PlainTextComponentSerializer.plainText().serialize(compEn);
        assertTrue(textEn.contains("Proximity voice is active!"));

        Component compEs = translationService.render(Locale.forLanguageTag("es-ES"), "notification.join");
        String textEs = PlainTextComponentSerializer.plainText().serialize(compEs);
        assertTrue(textEs.contains("chat de voz por proximidad"));
    }

    @Test
    void testMissingKeyReturnsKey() {
        Component comp = translationService.render(Locale.US, "non.existent.key");
        String text = PlainTextComponentSerializer.plainText().serialize(comp);
        assertEquals("non.existent.key", text);
    }
}
