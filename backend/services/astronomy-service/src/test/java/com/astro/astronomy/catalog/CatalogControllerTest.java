package com.astro.astronomy.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.net.URI;
import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CatalogControllerTest {
    private final CatalogManifestService service = mock(CatalogManifestService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new CatalogController(service))
            .setControllerAdvice(new CatalogExceptionHandler())
            .build();

    @Test
    void returnsThePublishedManifestWithRevalidationHeaders() throws Exception {
        when(service.getManifest()).thenReturn(manifest());

        mockMvc.perform(get("/api/astronomy/catalogs/naked-eye/manifest"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(header().string("Cache-Control", "no-cache"))
                .andExpect(header().string("ETag", "\"test-catalog-1\""))
                .andExpect(jsonPath("$.catalogId").value("naked-eye"))
                .andExpect(jsonPath("$.starCount").value(9000));
    }

    @Test
    void returnsAStableErrorCodeWhenNoCatalogIsPublished() throws Exception {
        when(service.getManifest()).thenThrow(
                new CatalogUnavailableException("The naked-eye catalog has not been published")
        );

        mockMvc.perform(get("/api/astronomy/catalogs/naked-eye/manifest"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("CATALOG_UNAVAILABLE"));
    }

    private CatalogManifest manifest() {
        return new CatalogManifest(
                1,
                "naked-eye",
                "test-catalog-1",
                URI.create("/api/astronomy/catalogs/naked-eye/test-catalog-1"),
                "application/json",
                "br",
                "0".repeat(64),
                1024,
                9000,
                88,
                List.of(new CatalogSource(
                        "Gaia",
                        "DR3",
                        URI.create("https://www.cosmos.esa.int/web/gaia/dr3"),
                        "ESA/Gaia/DPAC"
                )),
                Instant.parse("2026-07-23T00:00:00Z")
        );
    }
}
