package com.astro.astronomy.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.net.URI;
import java.util.Map;

public record SkyContentAssetDescriptor(
        @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String assetId,
        @NotBlank @Pattern(regexp = "culture|search-index|featured-patterns") String assetType,
        @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String cultureId,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]*") String version,
        @NotNull URI downloadUrl,
        @NotBlank @Pattern(regexp = "application/json") String mediaType,
        @NotBlank @Pattern(regexp = "gzip") String contentEncoding,
        @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String sha256,
        @Positive long contentLength,
        @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String decodedSha256,
        @Positive long decodedContentLength,
        @NotEmpty Map<@NotBlank String, @PositiveOrZero Integer> recordCounts
) {
}
