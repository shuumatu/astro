package com.astro.astronomy.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SkyContentControllerTest {
    private final SkyContentManifestService manifestService = mock(SkyContentManifestService.class);
    private final SkyContentAssetService assetService = mock(SkyContentAssetService.class);
    private final MockMvc mockMvc = MockMvcBuilders
            .standaloneSetup(new SkyContentController(manifestService, assetService))
            .setControllerAdvice(new CatalogExceptionHandler())
            .build();

    @Test
    void returnsTheManifestWithRevalidationHeaders() throws Exception {
        when(manifestService.getManifest()).thenReturn(manifest());

        mockMvc.perform(get("/api/astronomy/catalogs/sky-content/manifest"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(header().string("Cache-Control", "no-cache"))
                .andExpect(header().string("ETag", "\"test-1\""))
                .andExpect(jsonPath("$.defaultCultureId").value("test-culture"));
    }

    @Test
    void returnsAnImmutableEncodedAsset() throws Exception {
        byte[] content = new byte[]{31, -117, 8, 0};
        SkyContentAssetDescriptor descriptor = descriptor(
                "culture-test-culture", "culture", "test-culture", content.length
        );
        when(assetService.getAsset(descriptor.assetId(), descriptor.version()))
                .thenReturn(new SkyContentAsset(descriptor, content));

        mockMvc.perform(get("/api/astronomy/catalogs/sky-content/"
                        + descriptor.assetId() + "/" + descriptor.version()))
                .andExpect(status().isOk())
                .andExpect(content().bytes(content))
                .andExpect(header().string("Content-Encoding", "gzip"))
                .andExpect(header().string("Content-Length", String.valueOf(content.length)))
                .andExpect(header().string("Cache-Control", "max-age=31536000, public, immutable"))
                .andExpect(header().string("ETag", '"' + descriptor.sha256() + '"'));
    }

    @Test
    void returnsAStableNotFoundError() throws Exception {
        when(assetService.getAsset("unknown", "test-1"))
                .thenThrow(new CatalogNotFoundException("Sky-content asset not found: unknown@test-1"));

        mockMvc.perform(get("/api/astronomy/catalogs/sky-content/unknown/test-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CATALOG_NOT_FOUND"));
    }

    private SkyContentManifest manifest() {
        return new SkyContentManifest(
                1,
                "sky-content",
                "test-1",
                "test-culture",
                List.of("test-culture"),
                "search-index",
                "featured-patterns",
                List.of("exact-interface-language", "en", "first-name"),
                List.of(
                        descriptor("culture-test-culture", "culture", "test-culture", 4),
                        descriptor("search-index", "search-index", null, 4),
                        descriptor("featured-patterns", "featured-patterns", null, 4)
                ),
                Instant.parse("2026-07-24T00:00:00Z")
        );
    }

    private SkyContentAssetDescriptor descriptor(
            String assetId,
            String assetType,
            String cultureId,
            long contentLength
    ) {
        return new SkyContentAssetDescriptor(
                assetId,
                assetType,
                cultureId,
                "test-1",
                URI.create("/api/astronomy/catalogs/sky-content/" + assetId + "/test-1"),
                "application/json",
                "gzip",
                "0".repeat(64),
                contentLength,
                "1".repeat(64),
                16,
                Map.of("records", 1)
        );
    }
}
