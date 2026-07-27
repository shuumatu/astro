package com.astro.media;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

import java.io.ByteArrayInputStream;
import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class S3MediaStorageTest {
    @Test
    void productionConfigurationDoesNotInspectOrCreateTheBucket() {
        S3Client client = mock(S3Client.class);
        S3MediaStorage storage = new S3MediaStorage(properties(false), client);

        storage.initializeBucket();

        verifyNoInteractions(client);
    }

    @Test
    void putSetsDeliveryHeadersWithoutEditorialMetadata() {
        S3Client client = mock(S3Client.class);
        S3MediaStorage storage = new S3MediaStorage(properties(false), client);
        byte[] bytes = new byte[]{1, 2, 3};

        storage.put("image.webp", new ByteArrayInputStream(bytes), bytes.length, "image/webp");

        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(client).putObject(request.capture(), any(RequestBody.class));
        assertThat(request.getValue().bucket()).isEqualTo("catalog-media");
        assertThat(request.getValue().key()).isEqualTo("catalog/image.webp");
        assertThat(request.getValue().contentType()).isEqualTo("image/webp");
        assertThat(request.getValue().cacheControl()).isEqualTo(S3MediaStorage.IMMUTABLE_CACHE_CONTROL);
        assertThat(request.getValue().metadata()).isEmpty();
    }

    @Test
    void deletesTheExactObjectKey() {
        S3Client client = mock(S3Client.class);
        S3MediaStorage storage = new S3MediaStorage(properties(false), client);

        storage.delete("unused.webp");

        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(request.capture());
        assertThat(request.getValue().bucket()).isEqualTo("catalog-media");
        assertThat(request.getValue().key()).isEqualTo("catalog/unused.webp");
    }

    private MediaProperties properties(boolean autoCreateBucket) {
        return new MediaProperties(
                URI.create("https://account-id.r2.cloudflarestorage.com"),
                "auto", "key", "secret", "catalog-media", "catalog", true, autoCreateBucket,
                MediaProperties.DeliveryMode.DIRECT, "https://media.example.com");
    }
}
