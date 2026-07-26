package com.astro.content.catalog;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum CatalogObjectType {
    STAR("star"),
    SOLAR_SYSTEM_BODY("solar-system-body"),
    CULTURE_FIGURE("culture-figure"),
    FEATURED_PATTERN("featured-pattern");

    private final String value;

    CatalogObjectType(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static CatalogObjectType fromValue(String value) {
        return Arrays.stream(values())
                .filter(candidate -> candidate.value.equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown catalog object type: " + value));
    }
}
