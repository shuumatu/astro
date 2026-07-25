package com.astro.content.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MediaInput(
        @NotBlank @Size(max = 200) String mediaId,
        @NotBlank @Size(max = 500) String altText,
        @Size(max = 500) String caption,
        @Size(max = 240) String author,
        @Size(max = 160) String license,
        @Size(max = 500) String attribution
) {
}
