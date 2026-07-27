package com.astro.content.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "astro.media")
public record MediaUrlProperties(
        @NotBlank String publicBaseUrl,
        @NotBlank String keyPrefix,
        @NotNull DeliveryMode deliveryMode
) {
    public MediaUrlProperties {
        publicBaseUrl = stripTrailingSlashes(publicBaseUrl);
        keyPrefix = normalizeKeyPrefix(keyPrefix);
    }

    public String assetUrl(String mediaId) {
        String path = deliveryMode == DeliveryMode.DIRECT ? keyPrefix + "/" + mediaId : mediaId;
        return publicBaseUrl + "/" + path;
    }

    private static String stripTrailingSlashes(String value) {
        String normalized = value.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Media public base URL must not be empty");
        }
        return normalized;
    }

    private static String normalizeKeyPrefix(String value) {
        String normalized = value.trim().replace('\\', '/');
        while (normalized.startsWith("/")) normalized = normalized.substring(1);
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        if (normalized.isBlank() || normalized.contains("//") || normalized.contains("..")) {
            throw new IllegalArgumentException("Media key prefix must be a safe, non-empty path");
        }
        return normalized;
    }

    public enum DeliveryMode {
        PROXY,
        DIRECT
    }
}
