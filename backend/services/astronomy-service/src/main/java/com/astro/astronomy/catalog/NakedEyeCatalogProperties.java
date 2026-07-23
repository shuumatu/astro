package com.astro.astronomy.catalog;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.core.io.Resource;

@ConfigurationProperties(prefix = "astro.catalog.naked-eye")
public class NakedEyeCatalogProperties {
    private Resource manifestLocation;

    public Resource getManifestLocation() {
        return manifestLocation;
    }

    public void setManifestLocation(Resource manifestLocation) {
        this.manifestLocation = manifestLocation;
    }
}
