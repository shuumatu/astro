package com.astro.media;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaPropertiesTest {
    @Test
    void normalizesProxyBaseUrl() {
        MediaProperties properties = properties(MediaProperties.DeliveryMode.PROXY, "/api/media/assets///");

        assertThat(properties.publicBaseUrl()).isEqualTo("/api/media/assets");
        assertThat(properties.assetUrl("image.webp")).isEqualTo("/api/media/assets/image.webp");
    }

    @Test
    void acceptsAnHttpsBaseUrlForDirectDelivery() {
        MediaProperties properties = properties(
                MediaProperties.DeliveryMode.DIRECT,
                "https://media.example.com/");

        assertThat(properties.assetUrl("image.webp"))
                .isEqualTo("https://media.example.com/catalog/image.webp");
        assertThat(properties.objectKey("image.webp")).isEqualTo("catalog/image.webp");
    }

    @Test
    void rejectsNonHttpsDirectDeliveryUrls() {
        assertThatThrownBy(() -> properties(MediaProperties.DeliveryMode.DIRECT, "http://media.example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("HTTPS");
    }

    private MediaProperties properties(MediaProperties.DeliveryMode mode, String publicBaseUrl) {
        return new MediaProperties(
                URI.create("http://localhost:9000"),
                "us-east-1",
                "access-key",
                "secret-key",
                "catalog-media",
                "catalog",
                true,
                true,
                mode,
                publicBaseUrl);
    }
}
