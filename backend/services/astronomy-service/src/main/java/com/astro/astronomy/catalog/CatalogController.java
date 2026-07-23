package com.astro.astronomy.catalog;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/astronomy/catalogs/naked-eye")
public class CatalogController {
    private final CatalogManifestService manifestService;

    public CatalogController(CatalogManifestService manifestService) {
        this.manifestService = manifestService;
    }

    @GetMapping(value = "/manifest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CatalogManifest> getManifest() {
        CatalogManifest manifest = manifestService.getManifest();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .eTag('"' + manifest.version() + '"')
                .body(manifest);
    }
}
