package com.astro.astronomy.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;

import java.net.URI;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CatalogAssetServiceTest {
    private final CatalogManifestService manifestService = mock(CatalogManifestService.class);

    @Test
    void validatesAndCachesTheEncodedAsset() throws Exception {
        byte[] content = new byte[]{31, -117, 8, 0};
        CatalogManifest manifest = manifest(content.length, sha256(content));
        when(manifestService.getManifest()).thenReturn(manifest);
        CatalogAssetService service = serviceFor(content);

        CatalogAsset first = service.getAsset(manifest.version());
        CatalogAsset second = service.getAsset(manifest.version());

        assertThat(first.content()).containsExactly(content);
        assertThat(first.manifest()).isSameAs(manifest);
        assertThat(second).isSameAs(first);
    }

    @Test
    void rejectsAnUnknownVersionBeforeReadingTheAsset() {
        when(manifestService.getManifest()).thenReturn(manifest(4, "0".repeat(64)));

        assertThatThrownBy(() -> serviceFor(new byte[0]).getAsset("unknown"))
                .isInstanceOf(CatalogNotFoundException.class)
                .hasMessage("Naked-eye catalog version not found: unknown");
    }

    @Test
    void rejectsAnAssetWhoseChecksumDoesNotMatch() {
        byte[] content = new byte[]{31, -117, 8, 0};
        CatalogManifest manifest = manifest(content.length, "0".repeat(64));
        when(manifestService.getManifest()).thenReturn(manifest);

        assertThatThrownBy(() -> serviceFor(content).getAsset(manifest.version()))
                .isInstanceOf(CatalogUnavailableException.class)
                .hasMessage("The naked-eye catalog checksum does not match its manifest");
    }

    private CatalogAssetService serviceFor(byte[] content) {
        NakedEyeCatalogProperties properties = new NakedEyeCatalogProperties();
        properties.setAssetLocation(new ByteArrayResource(content));
        return new CatalogAssetService(manifestService, properties);
    }

    private CatalogManifest manifest(long contentLength, String sha256) {
        return new CatalogManifest(
                1,
                "naked-eye",
                "test-catalog-1",
                URI.create("/api/astronomy/catalogs/naked-eye/test-catalog-1"),
                "application/json",
                "gzip",
                sha256,
                contentLength,
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

    private String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }
}
