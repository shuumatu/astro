package com.astro.astronomy.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.ByteArrayInputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogArtifactTest {
    @Test
    void compressedArtifactMatchesItsManifestAndSchemaInvariants() throws Exception {
        ObjectMapper objectMapper = JsonMapper.builder().addModule(new JavaTimeModule()).build();
        NakedEyeCatalogProperties properties = new NakedEyeCatalogProperties();
        properties.setManifestLocation(new ClassPathResource("catalogs/naked-eye/manifest.json"));
        CatalogManifest manifest = new CatalogManifestService(
                properties,
                objectMapper,
                Validation.buildDefaultValidatorFactory().getValidator()
        ).getManifest();
        byte[] encoded = new ClassPathResource("catalogs/naked-eye/catalog.json.gz")
                .getInputStream()
                .readAllBytes();

        assertThat(encoded).hasSize((int) manifest.contentLength());
        assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(encoded)))
                .isEqualTo(manifest.sha256());

        byte[] decoded;
        try (GZIPInputStream input = new GZIPInputStream(new ByteArrayInputStream(encoded))) {
            decoded = input.readAllBytes();
        }
        assertThat(decoded).hasSize((int) manifest.decodedContentLength());
        assertThat(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(decoded)))
                .isEqualTo(manifest.decodedSha256());
        JsonNode catalog = objectMapper.readTree(decoded);
        assertThat(catalog.path("schemaVersion").asInt()).isEqualTo(2);
        assertThat(catalog.path("catalogId").asText()).isEqualTo("naked-eye");
        assertThat(catalog.path("referenceFrame").asText()).isEqualTo("ICRS");
        assertThat(catalog.path("stars")).hasSize(manifest.starCount());
        assertThat(catalog.has("constellations")).isFalse();

        Set<String> starIds = new HashSet<>();
        int gaiaCount = 0;
        for (JsonNode star : catalog.path("stars")) {
            assertThat(starIds.add(star.path("id").asText())).isTrue();
            assertThat(star.path("raDeg").asDouble()).isBetween(0.0, 360.0);
            assertThat(star.path("decDeg").asDouble()).isBetween(-90.0, 90.0);
            assertThat(star.path("visualMagnitude").asDouble()).isLessThanOrEqualTo(6.5);
            if (star.path("astrometrySource").asText().equals("GAIA_DR3")) {
                gaiaCount++;
                assertThat(star.path("epochYear").asDouble()).isEqualTo(2016.0);
            } else {
                assertThat(star.path("astrometrySource").asText()).isEqualTo("HIPPARCOS_2");
                assertThat(star.path("epochYear").asDouble()).isEqualTo(1991.25);
            }
        }
        assertThat(gaiaCount).isGreaterThan(6000);
    }
}
