package com.astro.astronomy.catalog;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/astronomy/catalogs/sky-content")
public class SkyContentController {
    private final SkyContentManifestService manifestService;
    private final SkyContentAssetService assetService;

    public SkyContentController(
            SkyContentManifestService manifestService,
            SkyContentAssetService assetService
    ) {
        this.manifestService = manifestService;
        this.assetService = assetService;
    }

    @GetMapping(value = "/manifest", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<SkyContentManifest> getManifest() {
        SkyContentManifest manifest = manifestService.getManifest();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .eTag('"' + manifest.version() + '"')
                .body(manifest);
    }

    @GetMapping(value = "/{assetId}/{version}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> getAsset(
            @PathVariable("assetId") String assetId,
            @PathVariable("version") String version
    ) {
        SkyContentAsset asset = assetService.getAsset(assetId, version);
        SkyContentAssetDescriptor descriptor = asset.descriptor();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(descriptor.mediaType()))
                .contentLength(descriptor.contentLength())
                .header("Content-Encoding", descriptor.contentEncoding())
                .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                .eTag('"' + descriptor.sha256() + '"')
                .body(asset.content());
    }
}
