package com.astro.media;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "R2_SMOKE_TEST", matches = "true")
class R2MediaStorageSmokeTest {
    @Test
    void uploadsReadsAndDeliversAnObjectThroughTheCustomDomain() throws Exception {
        MediaProperties properties = new MediaProperties(
                URI.create(required("MEDIA_S3_ENDPOINT")),
                required("MEDIA_S3_REGION"),
                required("MEDIA_S3_ACCESS_KEY"),
                required("MEDIA_S3_SECRET_KEY"),
                required("MEDIA_S3_BUCKET"),
                true,
                false,
                MediaProperties.DeliveryMode.DIRECT,
                required("MEDIA_PUBLIC_BASE_URL"));
        String mediaId = "codex-r2-smoke-" + UUID.randomUUID() + ".webp";
        byte[] image = new byte[]{'R', 'I', 'F', 'F', 4, 0, 0, 0, 'W', 'E', 'B', 'P'};

        try (S3Client client = new MediaStorageConfiguration().mediaS3Client(properties)) {
            S3MediaStorage storage = new S3MediaStorage(properties, client);
            try {
                storage.put(mediaId, new ByteArrayInputStream(image), image.length, "image/webp");

                HeadObjectResponse head = client.headObject(HeadObjectRequest.builder()
                        .bucket(properties.bucket()).key(mediaId).build());
                assertThat(head.contentType()).isEqualTo("image/webp");
                assertThat(head.cacheControl()).isEqualTo(S3MediaStorage.IMMUTABLE_CACHE_CONTROL);
                try (StoredMedia stored = storage.open(mediaId)) {
                    assertThat(stored.content().readAllBytes()).containsExactly(image);
                }

                HttpRequest request = HttpRequest.newBuilder(URI.create(properties.assetUrl(mediaId)))
                        .timeout(Duration.ofSeconds(20))
                        .GET()
                        .build();
                HttpResponse<byte[]> response = HttpClient.newHttpClient()
                        .send(request, HttpResponse.BodyHandlers.ofByteArray());
                assertThat(response.statusCode()).isEqualTo(200);
                assertThat(response.headers().firstValue("content-type")).contains("image/webp");
                assertThat(response.headers().firstValue("cache-control"))
                        .contains(S3MediaStorage.IMMUTABLE_CACHE_CONTROL);
                assertThat(response.body()).containsExactly(image);
            } finally {
                client.deleteObject(DeleteObjectRequest.builder()
                        .bucket(properties.bucket()).key(mediaId).build());
            }
        }
    }

    private String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required for the R2 smoke test");
        }
        return value;
    }
}
