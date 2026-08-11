package com.astro.content.explore;

import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;

public record ExploreImageCreditInput(
        @NotBlank @Size(max = 2048) String imageUrl,
        @Size(max = 2048) String sourcePageUrl,
        @Size(max = 240) String author,
        @Size(max = 160) String license,
        @Size(max = 500) String attribution
) { }
