package com.astro.media;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;

@Validated
@ConfigurationProperties(prefix = "astro.media")
public record MediaProperties(
        @NotNull URI endpoint,
        @NotBlank String region,
        @NotBlank String accessKey,
        @NotBlank String secretKey,
        @NotBlank String bucket,
        @NotBlank String keyPrefix,
        boolean pathStyle,
        boolean autoCreateBucket,
        @NotNull DeliveryMode deliveryMode,
        @NotBlank String publicBaseUrl
) {
    public MediaProperties {
        publicBaseUrl = stripTrailingSlashes(publicBaseUrl);
        keyPrefix = normalizeKeyPrefix(keyPrefix);
        if (deliveryMode == DeliveryMode.DIRECT) {
            URI publicUri = URI.create(publicBaseUrl);
            if (!publicUri.isAbsolute() || !"https".equalsIgnoreCase(publicUri.getScheme())) {
                throw new IllegalArgumentException("Direct media delivery requires an absolute HTTPS public base URL");
            }
        }
    }

    public String assetUrl(String mediaId) {
        String path = deliveryMode == DeliveryMode.DIRECT ? objectKey(mediaId) : mediaId;
        return publicBaseUrl + "/" + path;
    }

    public String objectKey(String mediaId) {
        return keyPrefix + "/" + mediaId;
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
            throw new IllegalArgumentException("Media S3 key prefix must be a safe, non-empty object-key prefix");
        }
        return normalized;
    }

    public enum DeliveryMode {
        PROXY,
        DIRECT
    }
}
