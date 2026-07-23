package com.astro.astronomy.catalog;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/astronomy/catalogs/naked-eye")
public class CatalogController {
    private final CatalogManifestService manifestService;
    private final CatalogAssetService assetService;

    public CatalogController(CatalogManifestService manifestService, CatalogAssetService assetService) {
        this.manifestService = manifestService;
        this.assetService = assetService;
    }

    @GetMapping(value = "/manifest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CatalogManifest> getManifest() {
        CatalogManifest manifest = manifestService.getManifest();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .eTag('"' + manifest.version() + '"')
                .body(manifest);
    }

    @GetMapping(value = "/{version}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> getCatalog(@PathVariable("version") String version) {
        CatalogAsset asset = assetService.getAsset(version);
        CatalogManifest manifest = asset.manifest();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(manifest.mediaType()))
                .contentLength(manifest.contentLength())
                .header("Content-Encoding", manifest.contentEncoding())
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable())
                .eTag('"' + manifest.sha256() + '"')
                .body(asset.content());
    }
}
