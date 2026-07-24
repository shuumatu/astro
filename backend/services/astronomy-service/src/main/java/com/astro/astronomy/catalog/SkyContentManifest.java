package com.astro.astronomy.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.util.List;

public record SkyContentManifest(
        @Positive int schemaVersion,
        @NotBlank @Pattern(regexp = "sky-content") String catalogId,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9._-]*") String version,
        @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String defaultCultureId,
        @NotEmpty List<@Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String> cultureIds,
        @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String searchIndexAssetId,
        @NotBlank @Pattern(regexp = "[a-z0-9]+(?:-[a-z0-9]+)*") String featuredPatternsAssetId,
        @NotEmpty List<@NotBlank String> nameFallbackOrder,
        @NotEmpty List<@Valid SkyContentAssetDescriptor> assets,
        @NotNull Instant publishedAt
) {
}
