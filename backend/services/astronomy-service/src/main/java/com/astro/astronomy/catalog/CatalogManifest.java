package com.astro.astronomy.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.net.URI;
import java.time.Instant;
import java.util.List;

public record CatalogManifest(
        @Positive int schemaVersion,
        @NotBlank @Pattern(regexp = "naked-eye") String catalogId,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]*") String version,
        @NotNull URI downloadUrl,
        @NotBlank @Pattern(regexp = "application/json") String mediaType,
        @NotBlank @Pattern(regexp = "identity|br|gzip") String contentEncoding,
        @NotBlank @Pattern(regexp = "[a-f0-9]{64}") String sha256,
        @Positive long contentLength,
        @Positive int starCount,
        @Positive int constellationCount,
        @NotEmpty List<@Valid CatalogSource> sources,
        @NotNull Instant publishedAt
) {
}
