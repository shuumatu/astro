package com.astro.astronomy.catalog;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

@ConfigurationProperties(prefix = "astro.catalog.sky-content")
public class SkyContentCatalogProperties {
    private Resource manifestLocation;
    private Resource assetLocation;

    public Resource getManifestLocation() {
        return manifestLocation;
    }

    public void setManifestLocation(Resource manifestLocation) {
        this.manifestLocation = manifestLocation;
    }

    public Resource getAssetLocation() {
        return assetLocation;
    }

    public void setAssetLocation(Resource assetLocation) {
        this.assetLocation = assetLocation;
    }
}
