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

class CatalogManifestServiceTest {
    @Test
    void loadsAndCachesAValidManifest() {
        NakedEyeCatalogProperties properties = propertiesFor(
                new ClassPathResource("catalogs/naked-eye/test-manifest.json")
        );
        CatalogManifestService service = new CatalogManifestService(
                properties,
                JsonMapper.builder().addModule(new JavaTimeModule()).build(),
                Validation.buildDefaultValidatorFactory().getValidator()
        );

        CatalogManifest first = service.getManifest();
        CatalogManifest second = service.getManifest();

        assertThat(first.catalogId()).isEqualTo("naked-eye");
        assertThat(first.starCount()).isEqualTo(9000);
        assertThat(second).isSameAs(first);
    }

    @Test
    void reportsAnUnavailableCatalogWhenTheManifestIsMissing() {
        NakedEyeCatalogProperties properties = propertiesFor(
                new ClassPathResource("catalogs/naked-eye/missing.json")
        );
        CatalogManifestService service = new CatalogManifestService(
                properties,
                JsonMapper.builder().addModule(new JavaTimeModule()).build(),
                Validation.buildDefaultValidatorFactory().getValidator()
        );

        assertThatThrownBy(service::getManifest)
                .isInstanceOf(CatalogUnavailableException.class)
                .hasMessage("The naked-eye catalog has not been published");
    }

    @Test
    void rejectsAManifestWithUnknownFields() {
        Resource resource = new ByteArrayResource("""
                {
                  "schemaVersion": 1,
                  "catalogId": "naked-eye",
                  "version": "test-catalog-1",
                  "unexpected": true
                }
                """.getBytes(StandardCharsets.UTF_8));
        CatalogManifestService service = new CatalogManifestService(
                propertiesFor(resource),
                JsonMapper.builder().addModule(new JavaTimeModule()).build(),
                Validation.buildDefaultValidatorFactory().getValidator()
        );

        assertThatThrownBy(service::getManifest)
                .isInstanceOf(CatalogUnavailableException.class)
                .hasMessage("The naked-eye catalog manifest cannot be read");
    }

    private NakedEyeCatalogProperties propertiesFor(Resource resource) {
        NakedEyeCatalogProperties properties = new NakedEyeCatalogProperties();
        properties.setManifestLocation(resource);
        return properties;
    }
}
