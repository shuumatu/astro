package com.astro.content.explore;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExploreSourceInput(
        @NotBlank @Size(max = 240) String title,
        @NotBlank @Size(max = 2048) String url,
        @Size(max = 240) String author,
        @Size(max = 160) String license,
        @Size(max = 500) String attribution
) { }
