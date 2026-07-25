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
import java.util.HexFormat;
import java.util.zip.GZIPInputStream;

import static org.assertj.core.api.Assertions.assertThat;

class SkyContentArtifactTest {
    @Test
    void everyPublishedAssetMatchesItsManifest() throws Exception {
        ObjectMapper objectMapper = JsonMapper.builder().addModule(new JavaTimeModule()).build();
        SkyContentCatalogProperties properties = new SkyContentCatalogProperties();
        properties.setManifestLocation(new ClassPathResource("catalogs/sky-content/manifest.json"));
        SkyContentManifest manifest = new SkyContentManifestService(
                properties,
                objectMapper,
                Validation.buildDefaultValidatorFactory().getValidator()
        ).getManifest();

        assertThat(manifest.defaultCultureId()).isEqualTo("western-iau");
        assertThat(manifest.cultureIds()).containsExactly("chinese-traditional", "western-iau");
        assertThat(manifest.assets()).hasSize(4);

        for (SkyContentAssetDescriptor descriptor : manifest.assets()) {
            byte[] encoded = new ClassPathResource(
                    "catalogs/sky-content/" + descriptor.assetId() + ".json.gz"
            ).getInputStream().readAllBytes();
            assertThat(encoded).hasSize((int) descriptor.contentLength());
            assertThat(sha256(encoded)).isEqualTo(descriptor.sha256());

            byte[] decoded;
            try (GZIPInputStream input = new GZIPInputStream(new ByteArrayInputStream(encoded))) {
                decoded = input.readAllBytes();
            }
            assertThat(decoded).hasSize((int) descriptor.decodedContentLength());
            assertThat(sha256(decoded)).isEqualTo(descriptor.decodedSha256());
            JsonNode value = objectMapper.readTree(decoded);
            assertThat(value.path("schemaVersion").asInt()).isEqualTo(1);
            assertThat(value.path("version").asText()).isEqualTo(descriptor.version());
        }
    }

    @Test
    void searchIndexContainsTheAcceptanceAliasesAndExplicitCollisions() throws Exception {
        JsonNode searchIndex = readGzipJson("catalogs/sky-content/search-index.json.gz");
        assertThat(hasSearchEntry(searchIndex, "织女星", "HIP:91262")).isTrue();
        assertThat(hasSearchEntry(searchIndex, "辇道增七", "HIP:95947")).isTrue();
        assertThat(hasSearchEntry(searchIndex, "Vega", "HIP:91262")).isTrue();
        assertThat(searchIndex.path("collisions").isEmpty()).isFalse();
    }

    private JsonNode readGzipJson(String path) throws Exception {
        try (GZIPInputStream input = new GZIPInputStream(new ClassPathResource(path).getInputStream())) {
            return new ObjectMapper().readTree(input);
        }
    }

    private boolean hasSearchEntry(JsonNode index, String term, String objectId) {
        for (JsonNode entry : index.path("entries")) {
            if (entry.path("term").asText().equals(term)
                    && entry.path("objectId").asText().equals(objectId)) {
                return true;
            }
        }
        return false;
    }

    private String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }
}
