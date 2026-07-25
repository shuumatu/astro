package com.astro.content.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SourceInput(
        @NotBlank @Size(max = 240) String title,
        @NotBlank @Size(max = 1000) @Pattern(regexp = "https?://.+") String url,
        @Size(max = 240) String author,
        @Size(max = 160) String license,
        @Size(max = 500) String attribution
) {
}
