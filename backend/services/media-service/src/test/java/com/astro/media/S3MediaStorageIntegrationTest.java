package com.astro.media;

import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

import java.io.ByteArrayInputStream;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers(disabledWithoutDocker = true)
class S3MediaStorageIntegrationTest {
    private static final String ACCESS_KEY = "astro-test";
    private static final String SECRET_KEY = "astro-test-secret";
    private static final String BUCKET = "catalog-media";

    @Container
    private static final GenericContainer<?> MINIO = new GenericContainer<>(
            DockerImageName.parse("minio/minio:RELEASE.2025-04-22T22-12-26Z"))
            .withEnv("MINIO_ROOT_USER", ACCESS_KEY)
            .withEnv("MINIO_ROOT_PASSWORD", SECRET_KEY)
            .withCommand("server", "/data")
            .withExposedPorts(9000);

    @Test
    void createsBucketAndPreservesObjectHeaders() throws Exception {
        MediaProperties properties = new MediaProperties(
                URI.create("http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000)),
                "us-east-1", ACCESS_KEY, SECRET_KEY, BUCKET, "catalog", true, true,
                MediaProperties.DeliveryMode.PROXY, "/api/media/assets");
        try (S3Client client = new MediaStorageConfiguration().mediaS3Client(properties)) {
            S3MediaStorage storage = new S3MediaStorage(properties, client);
            storage.initializeBucket();
            byte[] image = new byte[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'};

            storage.put("sample.webp", new ByteArrayInputStream(image), image.length, "image/webp");

            HeadObjectResponse head = client.headObject(HeadObjectRequest.builder()
                    .bucket(BUCKET).key("catalog/sample.webp").build());
            assertThat(head.contentType()).isEqualTo("image/webp");
            assertThat(head.cacheControl()).isEqualTo(S3MediaStorage.IMMUTABLE_CACHE_CONTROL);
            try (StoredMedia stored = storage.open("sample.webp")) {
                assertThat(stored.content().readAllBytes()).containsExactly(image);
                assertThat(stored.contentType()).isEqualTo("image/webp");
            }
        }
    }
}
