package com.astro.astronomy.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;

import java.net.URI;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SkyContentAssetServiceTest {
    private final SkyContentManifestService manifestService = mock(SkyContentManifestService.class);

    @Test
    void validatesAndCachesAnEncodedAsset() throws Exception {
        byte[] content = new byte[]{31, -117, 8, 0};
        SkyContentAssetDescriptor descriptor = descriptor(content.length, sha256(content));
        when(manifestService.getAsset(descriptor.assetId(), descriptor.version())).thenReturn(descriptor);
        SkyContentAssetService service = serviceFor(content);

        SkyContentAsset first = service.getAsset(descriptor.assetId(), descriptor.version());
        SkyContentAsset second = service.getAsset(descriptor.assetId(), descriptor.version());

        assertThat(first.content()).containsExactly(content);
        assertThat(first.descriptor()).isSameAs(descriptor);
        assertThat(second).isSameAs(first);
    }

    @Test
    void rejectsAnAssetWhoseChecksumDoesNotMatch() {
        byte[] content = new byte[]{31, -117, 8, 0};
        SkyContentAssetDescriptor descriptor = descriptor(content.length, "0".repeat(64));
        when(manifestService.getAsset(descriptor.assetId(), descriptor.version())).thenReturn(descriptor);

        assertThatThrownBy(() -> serviceFor(content).getAsset(descriptor.assetId(), descriptor.version()))
                .isInstanceOf(CatalogUnavailableException.class)
                .hasMessage("The sky-content asset checksum does not match its manifest");
    }

    private SkyContentAssetService serviceFor(byte[] content) {
        Resource root = new ByteArrayResource(new byte[0]) {
            @Override
            public Resource createRelative(String relativePath) {
                return new ByteArrayResource(content);
            }
        };
        SkyContentCatalogProperties properties = new SkyContentCatalogProperties();
        properties.setAssetLocation(root);
        return new SkyContentAssetService(manifestService, properties);
    }

    private SkyContentAssetDescriptor descriptor(long contentLength, String sha256) {
        return new SkyContentAssetDescriptor(
                "search-index",
                "search-index",
                null,
                "test-1",
                URI.create("/api/astronomy/catalogs/sky-content/search-index/test-1"),
                "application/json",
                "gzip",
                sha256,
                contentLength,
                "1".repeat(64),
                16,
                Map.of("entries", 1)
        );
    }

    private String sha256(byte[] content) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }
}
