package com.astro.identity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "astro.identity")
public record IdentityProperties(
        @NotBlank String adminUsername,
        @NotBlank String adminPassword,
        @NotBlank String jwtSecret,
        @NotNull Duration tokenTtl
) {
}
