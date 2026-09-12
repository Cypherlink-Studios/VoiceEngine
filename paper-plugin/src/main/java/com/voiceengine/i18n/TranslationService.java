package com.voiceengine.i18n;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;

import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Logger;

public class TranslationService {
    private static final Logger LOGGER = Logger.getLogger(TranslationService.class.getName());
    private static final MiniMessage MINI_MESSAGE = MiniMessage.miniMessage();
    private static final String[] BUNDLED_LOCALES = {"en_US", "es_ES"};

    private final Map<String, YamlConfiguration> localeConfigs = new HashMap<>();
    private String defaultLocaleKey = "en_us";

    public TranslationService() {
    }

    /**
     * Initializes translations from the plugin data folder, extracting bundled defaults if needed.
     */
    public void load(File dataFolder, String configuredDefaultLocale) {
        this.defaultLocaleKey = normalizeLocaleKey(configuredDefaultLocale);
        localeConfigs.clear();

        File langFolder = new File(dataFolder, "lang");
        if (!langFolder.exists()) {
            langFolder.mkdirs();
        }

        // Extract bundled defaults if they do not exist
        for (String bundled : BUNDLED_LOCALES) {
            File targetFile = new File(langFolder, "messages_" + bundled + ".yml");
            if (!targetFile.exists()) {
                String resourcePath = "/lang/messages_" + bundled + ".yml";
                try (InputStream in = getClass().getResourceAsStream(resourcePath)) {
                    if (in != null) {
                        Files.copy(in, targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
                    }
                } catch (Exception e) {
                    LOGGER.warning("Could not extract bundled translation " + resourcePath + ": " + e.getMessage());
                }
            }
        }

        // Load all YAML files in the lang directory
        File[] files = langFolder.listFiles((dir, name) -> name.startsWith("messages_") && name.endsWith(".yml"));
        if (files != null) {
            for (File file : files) {
                String name = file.getName();
                String localePart = name.substring("messages_".length(), name.length() - ".yml".length());
                String key = normalizeLocaleKey(localePart);
                try {
                    YamlConfiguration config = YamlConfiguration.loadConfiguration(file);
                    localeConfigs.put(key, config);
                } catch (Exception e) {
                    LOGGER.warning("Failed to load language file " + file.getName() + ": " + e.getMessage());
                }
            }
        }

        // Ensure default fallback is present in memory from bundle if missing on disk
        if (!localeConfigs.containsKey(defaultLocaleKey)) {
            loadBundledFallback(defaultLocaleKey);
        }
    }

    /**
     * Loads a configuration directly into memory (useful for testing or fallback).
     */
    public void registerLocale(String localeName, YamlConfiguration configuration) {
        localeConfigs.put(normalizeLocaleKey(localeName), configuration);
    }

    private void loadBundledFallback(String normalizedKey) {
        for (String bundled : BUNDLED_LOCALES) {
            if (normalizeLocaleKey(bundled).equals(normalizedKey) || bundled.equalsIgnoreCase("en_US")) {
                try (InputStream in = getClass().getResourceAsStream("/lang/messages_" + bundled + ".yml")) {
                    if (in != null) {
                        YamlConfiguration config = YamlConfiguration.loadConfiguration(new InputStreamReader(in, StandardCharsets.UTF_8));
                        localeConfigs.put(normalizeLocaleKey(bundled), config);
                        return;
                    }
                } catch (Exception e) {
                    LOGGER.warning("Failed to load embedded fallback for " + bundled + ": " + e.getMessage());
                }
            }
        }
    }

    public Component render(CommandSender sender, String key, TagResolver... tags) {
        Locale locale = (sender instanceof Player player) ? player.locale() : Locale.forLanguageTag(defaultLocaleKey);
        return render(locale, key, tags);
    }

    public Component render(Locale locale, String key, TagResolver... tags) {
        String rawTemplate = getRaw(locale, key);
        if (rawTemplate == null || rawTemplate.isEmpty()) {
            return Component.text(key);
        }

        TagResolver prefixResolver = getPrefixResolver(locale);
        TagResolver combined = TagResolver.resolver(prefixResolver, TagResolver.resolver(tags));
        return MINI_MESSAGE.deserialize(rawTemplate, combined);
    }

    public void send(CommandSender sender, String key, TagResolver... tags) {
        sender.sendMessage(render(sender, key, tags));
    }

    public String getRaw(Locale locale, String key) {
        String normalizedKey = locale != null ? normalizeLocaleKey(locale.toString()) : defaultLocaleKey;

        // 1. Try exact locale match (e.g., "es_es")
        YamlConfiguration config = localeConfigs.get(normalizedKey);
        if (config != null && config.contains(key)) {
            return config.getString(key);
        }

        // 2. Try language-only match if locale has country (e.g. "es" from "es_es")
        if (normalizedKey.contains("_")) {
            String langOnly = normalizedKey.substring(0, normalizedKey.indexOf('_'));
            YamlConfiguration langConfig = localeConfigs.get(langOnly);
            if (langConfig != null && langConfig.contains(key)) {
                return langConfig.getString(key);
            }
        }

        // 3. Fallback to server default locale
        YamlConfiguration defaultConfig = localeConfigs.get(defaultLocaleKey);
        if (defaultConfig != null && defaultConfig.contains(key)) {
            return defaultConfig.getString(key);
        }

        // 4. Absolute fallback to en_us if default wasn't en_us
        if (!defaultLocaleKey.equals("en_us")) {
            YamlConfiguration enConfig = localeConfigs.get("en_us");
            if (enConfig != null && enConfig.contains(key)) {
                return enConfig.getString(key);
            }
        }

        return null;
    }

    private TagResolver getPrefixResolver(Locale locale) {
        String prefix = getRaw(locale, "prefix");
        if (prefix == null) prefix = "[VoiceEngine] ";
        String prefixAdmin = getRaw(locale, "prefix_admin");
        if (prefixAdmin == null) prefixAdmin = "[VoiceEngine Admin] ";

        return TagResolver.resolver(
            Placeholder.parsed("prefix", prefix),
            Placeholder.parsed("prefix_admin", prefixAdmin)
        );
    }

    public String getDefaultLocaleKey() {
        return defaultLocaleKey;
    }

    public static String normalizeLocaleKey(String input) {
        if (input == null) return "en_us";
        return input.replace('-', '_').trim().toLowerCase(Locale.ROOT);
    }
}
