package com.astro.astronomy.catalog;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class SkyContentManifestService {
    private final Resource manifestResource;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private volatile SkyContentManifest cachedManifest;

    public SkyContentManifestService(
            SkyContentCatalogProperties properties,
            ObjectMapper objectMapper,
            Validator validator
    ) {
        this.manifestResource = properties.getManifestLocation();
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    public SkyContentManifest getManifest() {
        SkyContentManifest manifest = cachedManifest;
        if (manifest != null) {
            return manifest;
        }

        synchronized (this) {
            if (cachedManifest == null) {
                cachedManifest = loadManifest();
            }
            return cachedManifest;
        }
    }

    public SkyContentAssetDescriptor getAsset(String assetId, String version) {
        if (assetId == null || !assetId.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) {
            throw notFound(assetId, version);
        }
        return getManifest().assets().stream()
                .filter(asset -> asset.assetId().equals(assetId) && asset.version().equals(version))
                .findFirst()
                .orElseThrow(() -> notFound(assetId, version));
    }

    private SkyContentManifest loadManifest() {
        if (manifestResource == null || !manifestResource.exists()) {
            throw new CatalogUnavailableException("The sky-content manifest has not been published");
        }

        try (InputStream input = manifestResource.getInputStream()) {
            SkyContentManifest manifest = objectMapper.readerFor(SkyContentManifest.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(input);
            validate(manifest);
            return manifest;
        } catch (IOException exception) {
            throw new CatalogUnavailableException("The sky-content manifest cannot be read", exception);
        }
    }

    private void validate(SkyContentManifest manifest) {
        Set<ConstraintViolation<SkyContentManifest>> violations = validator.validate(manifest);
        if (!violations.isEmpty()) {
            String details = violations.stream()
                    .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                    .sorted()
                    .collect(Collectors.joining(", "));
            throw new CatalogUnavailableException("The sky-content manifest is invalid: " + details);
        }

        Set<String> assetIds = new HashSet<>();
        for (SkyContentAssetDescriptor asset : manifest.assets()) {
            if (!assetIds.add(asset.assetId())) {
                throw new CatalogUnavailableException("The sky-content manifest contains duplicate asset IDs");
            }
            if (!asset.version().equals(manifest.version())) {
                throw new CatalogUnavailableException("The sky-content asset version does not match the manifest");
            }
            boolean cultureAsset = asset.assetType().equals("culture");
            if (cultureAsset != (asset.cultureId() != null)) {
                throw new CatalogUnavailableException("Only sky-content culture assets may declare a culture ID");
            }
        }
        if (!manifest.cultureIds().contains(manifest.defaultCultureId())) {
            throw new CatalogUnavailableException("The default sky culture is not declared by the manifest");
        }
        requireAssetType(manifest, manifest.searchIndexAssetId(), "search-index");
        requireAssetType(manifest, manifest.featuredPatternsAssetId(), "featured-patterns");
        for (String cultureId : manifest.cultureIds()) {
            boolean present = manifest.assets().stream()
                    .anyMatch(asset -> cultureId.equals(asset.cultureId()) && asset.assetType().equals("culture"));
            if (!present) {
                throw new CatalogUnavailableException("The sky-content manifest is missing culture " + cultureId);
            }
        }
    }

    private void requireAssetType(SkyContentManifest manifest, String assetId, String assetType) {
        boolean present = manifest.assets().stream()
                .anyMatch(asset -> asset.assetId().equals(assetId) && asset.assetType().equals(assetType));
        if (!present) {
            throw new CatalogUnavailableException("The sky-content manifest is missing " + assetType);
        }
    }

    private CatalogNotFoundException notFound(String assetId, String version) {
        return new CatalogNotFoundException(
                "Sky-content asset not found: " + String.valueOf(assetId) + "@" + String.valueOf(version)
        );
    }
}
