package com.astro.astronomy.catalog;

import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SkyContentAssetService {
    private final SkyContentManifestService manifestService;
    private final Resource assetLocation;
    private final Map<String, SkyContentAsset> cachedAssets = new ConcurrentHashMap<>();

    public SkyContentAssetService(
            SkyContentManifestService manifestService,
            SkyContentCatalogProperties properties
    ) {
        this.manifestService = manifestService;
        this.assetLocation = properties.getAssetLocation();
    }

    public SkyContentAsset getAsset(String assetId, String version) {
        SkyContentAssetDescriptor descriptor = manifestService.getAsset(assetId, version);
        return cachedAssets.computeIfAbsent(descriptor.assetId(), ignored -> loadAndValidate(descriptor));
    }

    private SkyContentAsset loadAndValidate(SkyContentAssetDescriptor descriptor) {
        if (assetLocation == null) {
            throw new CatalogUnavailableException("The sky-content asset location is not configured");
        }

        try {
            Resource resource = assetLocation.createRelative(descriptor.assetId() + ".json.gz");
            if (!resource.exists()) {
                throw new CatalogUnavailableException("The sky-content asset has not been published: " + descriptor.assetId());
            }
            try (InputStream input = resource.getInputStream()) {
                byte[] content = input.readAllBytes();
                if (content.length != descriptor.contentLength()) {
                    throw new CatalogUnavailableException("The sky-content asset content length does not match its manifest");
                }
                if (!sha256(content).equals(descriptor.sha256())) {
                    throw new CatalogUnavailableException("The sky-content asset checksum does not match its manifest");
                }
                return new SkyContentAsset(descriptor, content);
            }
        } catch (IOException exception) {
            throw new CatalogUnavailableException("The sky-content asset cannot be read", exception);
        }
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available", exception);
        }
    }
}
