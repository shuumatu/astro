package com.astro.content.catalog;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "astro.media")
public record MediaUrlProperties(@NotBlank String publicBaseUrl) {
    public MediaUrlProperties {
        publicBaseUrl = stripTrailingSlashes(publicBaseUrl);
    }

    public String assetUrl(String mediaId) {
        return publicBaseUrl + "/" + mediaId;
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
}
