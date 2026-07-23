package com.astro.astronomy.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.net.URI;

public record CatalogSource(
        @NotBlank String catalog,
        @NotBlank String release,
        @NotNull URI url,
        @NotBlank String credit
) {
}
