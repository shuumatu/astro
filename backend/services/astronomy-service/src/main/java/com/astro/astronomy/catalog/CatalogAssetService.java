package com.astro.astronomy.catalog;

import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class CatalogAssetService {
    private final CatalogManifestService manifestService;
    private final Resource assetResource;
    private volatile CatalogAsset cachedAsset;

    public CatalogAssetService(
            CatalogManifestService manifestService,
            NakedEyeCatalogProperties properties
    ) {
        this.manifestService = manifestService;
        this.assetResource = properties.getAssetLocation();
    }

    public CatalogAsset getAsset(String version) {
        CatalogManifest manifest = manifestService.getManifest();
        if (!manifest.version().equals(version)) {
            throw new CatalogNotFoundException("Naked-eye catalog version not found: " + version);
        }

        CatalogAsset asset = cachedAsset;
        if (asset != null) {
            return asset;
        }

        synchronized (this) {
            if (cachedAsset == null) {
                cachedAsset = loadAndValidate(manifest);
            }
            return cachedAsset;
        }
    }

    private CatalogAsset loadAndValidate(CatalogManifest manifest) {
        if (assetResource == null || !assetResource.exists()) {
            throw new CatalogUnavailableException("The naked-eye catalog asset has not been published");
        }

        try (InputStream input = assetResource.getInputStream()) {
            byte[] content = input.readAllBytes();
            if (content.length != manifest.contentLength()) {
                throw new CatalogUnavailableException("The naked-eye catalog content length does not match its manifest");
            }

            String sha256 = sha256(content);
            if (!sha256.equals(manifest.sha256())) {
                throw new CatalogUnavailableException("The naked-eye catalog checksum does not match its manifest");
            }
            return new CatalogAsset(manifest, content);
        } catch (IOException exception) {
            throw new CatalogUnavailableException("The naked-eye catalog asset cannot be read", exception);
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
