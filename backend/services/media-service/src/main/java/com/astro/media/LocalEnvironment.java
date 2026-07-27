package com.astro.media;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

final class LocalEnvironment {
    private static final List<String> DEFAULT_ENV_FILES = List.of(
            "deploy/compose/.env.production",
            "deploy/compose/.env.r2");
    private static final String ENV_FILE_OVERRIDE = "ASTRO_ENV_FILE";
    private static final String LEGACY_ENV_FILE_OVERRIDE = "ASTRO_LOCAL_ENV_FILE";

    private LocalEnvironment() {
    }

    static void load() {
        findEnvFile().stream().findFirst().ifPresent(LocalEnvironment::loadFile);
    }

    private static List<Path> findEnvFile() {
        List<Path> candidates = new ArrayList<>();
        addExplicitCandidate(candidates, ENV_FILE_OVERRIDE);
        addExplicitCandidate(candidates, LEGACY_ENV_FILE_OVERRIDE);

        Path current = Path.of("").toAbsolutePath();
        for (Path directory = current; directory != null; directory = directory.getParent()) {
            for (String envFile : DEFAULT_ENV_FILES) {
                candidates.add(directory.resolve(envFile));
            }
        }
        return candidates.stream().filter(Files::isRegularFile).distinct().toList();
    }

    private static void addExplicitCandidate(List<Path> candidates, String name) {
        String explicit = System.getenv(name);
        if (explicit != null && !explicit.isBlank()) candidates.add(Path.of(explicit.trim()));
        explicit = System.getProperty(name);
        if (explicit != null && !explicit.isBlank()) candidates.add(Path.of(explicit.trim()));
    }

    private static void loadFile(Path file) {
        try {
            for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                loadLine(line);
            }
            System.out.println("Loaded local environment file: " + file.toAbsolutePath());
        } catch (IOException error) {
            throw new IllegalStateException("Failed to read local environment file: " + file.toAbsolutePath(), error);
        }
    }

    private static void loadLine(String line) {
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) return;
        if (trimmed.startsWith("export ")) trimmed = trimmed.substring("export ".length()).trim();

        int separator = trimmed.indexOf('=');
        if (separator <= 0) return;

        String name = trimmed.substring(0, separator).trim();
        String value = unquote(trimmed.substring(separator + 1).trim());
        if (name.isEmpty() || System.getenv(name) != null || System.getProperty(name) != null) return;
        System.setProperty(name, value);
    }

    private static String unquote(String value) {
        if (value.length() < 2) return value;
        char first = value.charAt(0);
        char last = value.charAt(value.length() - 1);
        if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }
}
