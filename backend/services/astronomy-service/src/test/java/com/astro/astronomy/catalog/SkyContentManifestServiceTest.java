package com.astro.astronomy.catalog;

import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SkyContentManifestServiceTest {
    @Test
    void loadsCachesAndIndexesAValidManifest() {
        SkyContentManifestService service = serviceFor(
                new ClassPathResource("catalogs/sky-content/test-manifest.json")
        );

        SkyContentManifest first = service.getManifest();
        SkyContentManifest second = service.getManifest();

        assertThat(first.catalogId()).isEqualTo("sky-content");
        assertThat(first.assets()).hasSize(3);
        assertThat(service.getAsset("search-index", "test-1").assetType()).isEqualTo("search-index");
        assertThat(second).isSameAs(first);
    }

    @Test
    void rejectsInvalidOrUnknownAssetIdentifiers() {
        SkyContentManifestService service = serviceFor(
                new ClassPathResource("catalogs/sky-content/test-manifest.json")
        );

        assertThatThrownBy(() -> service.getAsset("../manifest", "test-1"))
                .isInstanceOf(CatalogNotFoundException.class);
        assertThatThrownBy(() -> service.getAsset("unknown", "test-1"))
                .isInstanceOf(CatalogNotFoundException.class);
        assertThatThrownBy(() -> service.getAsset("search-index", "unknown"))
                .isInstanceOf(CatalogNotFoundException.class);
    }

    @Test
    void rejectsUnknownManifestFields() {
        Resource resource = new ByteArrayResource("""
                {
                  "schemaVersion": 1,
                  "catalogId": "sky-content",
                  "version": "test-1",
                  "unexpected": true
                }
                """.getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> serviceFor(resource).getManifest())
                .isInstanceOf(CatalogUnavailableException.class)
                .hasMessage("The sky-content manifest cannot be read");
    }

    private SkyContentManifestService serviceFor(Resource resource) {
        SkyContentCatalogProperties properties = new SkyContentCatalogProperties();
        properties.setManifestLocation(resource);
        return new SkyContentManifestService(
                properties,
                JsonMapper.builder().addModule(new JavaTimeModule()).build(),
                Validation.buildDefaultValidatorFactory().getValidator()
        );
    }
}
