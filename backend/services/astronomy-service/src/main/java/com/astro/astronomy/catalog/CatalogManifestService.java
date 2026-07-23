package com.astro.astronomy.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class CatalogManifestService {
    private final Resource manifestResource;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private volatile CatalogManifest cachedManifest;

    public CatalogManifestService(
            NakedEyeCatalogProperties properties,
            ObjectMapper objectMapper,
            Validator validator
    ) {
        this.manifestResource = properties.getManifestLocation();
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    public CatalogManifest getManifest() {
        CatalogManifest manifest = cachedManifest;
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

    private CatalogManifest loadManifest() {
        if (manifestResource == null || !manifestResource.exists()) {
            throw new CatalogUnavailableException("The naked-eye catalog has not been published");
        }

        try (InputStream input = manifestResource.getInputStream()) {
            CatalogManifest manifest = objectMapper.readerFor(CatalogManifest.class)
                    .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(input);
            validate(manifest);
            return manifest;
        } catch (IOException exception) {
            throw new CatalogUnavailableException("The naked-eye catalog manifest cannot be read", exception);
        }
    }

    private void validate(CatalogManifest manifest) {
        Set<ConstraintViolation<CatalogManifest>> violations = validator.validate(manifest);
        if (violations.isEmpty()) {
            return;
        }

        String details = violations.stream()
                .map(violation -> violation.getPropertyPath() + " " + violation.getMessage())
                .sorted()
                .collect(Collectors.joining(", "));
        throw new CatalogUnavailableException("The naked-eye catalog manifest is invalid: " + details);
    }
}
