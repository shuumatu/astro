package com.astro.astronomy.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class CatalogApplicationTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void servesThePublishedManifestAndCatalog() throws Exception {
        mockMvc.perform(get("/api/astronomy/catalogs/naked-eye/manifest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("2026.07.2"))
                .andExpect(jsonPath("$.starCount").value(8870));

        mockMvc.perform(get("/api/astronomy/catalogs/naked-eye/2026.07.2"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Encoding", "gzip"))
                .andExpect(header().exists("ETag"));
    }

    @Test
    void servesThePublishedSkyContentManifestAndAssets() throws Exception {
        mockMvc.perform(get("/api/astronomy/catalogs/sky-content/manifest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value("2026.07.5"))
                .andExpect(jsonPath("$.defaultCultureId").value("western-iau"))
                .andExpect(jsonPath("$.assets.length()").value(4));

        mockMvc.perform(get("/api/astronomy/catalogs/sky-content/culture-chinese-traditional/2026.07.5"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Encoding", "gzip"))
                .andExpect(header().string("Cache-Control", "max-age=31536000, public, immutable"))
                .andExpect(header().exists("ETag"));
    }
}
