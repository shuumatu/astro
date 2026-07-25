package com.astro.media;

import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaStorage {
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final MediaProperties properties;
    private final MinioClient minioClient;

    public MediaStorage(MediaProperties properties) {
        this.properties = properties;
        this.minioClient = MinioClient.builder()
                .endpoint(properties.endpoint())
                .credentials(properties.accessKey(), properties.secretKey())
                .build();
    }

    private void ensureBucket() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(properties.bucket()).build());
        if (!exists) minioClient.makeBucket(MakeBucketArgs.builder().bucket(properties.bucket()).build());
    }

    public MediaAsset upload(MultipartFile file, MediaMetadata metadata) throws Exception {
        String contentType = file.getContentType();
        if (file.isEmpty() || contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only non-empty JPEG, PNG, and WebP images are accepted");
        }
        ensureBucket();
        String mediaId = UUID.randomUUID() + extension(contentType);
        Map<String, String> userMetadata = Map.of(
                "alt-text", metadata.altText(),
                "author", nullToEmpty(metadata.author()),
                "license", nullToEmpty(metadata.license()),
                "attribution", nullToEmpty(metadata.attribution()));
        try (InputStream input = file.getInputStream()) {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(properties.bucket())
                    .object(mediaId)
                    .stream(input, file.getSize(), -1)
                    .contentType(contentType)
                    .userMetadata(userMetadata)
                    .build());
        }
        return new MediaAsset(mediaId, "/api/media/assets/" + mediaId, contentType, file.getSize(), metadata);
    }

    public StoredMedia open(String mediaId) throws Exception {
        StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                .bucket(properties.bucket()).object(mediaId).build());
        GetObjectResponse content = minioClient.getObject(GetObjectArgs.builder()
                .bucket(properties.bucket()).object(mediaId).build());
        return new StoredMedia(content, stat.contentType(), stat.size());
    }

    private String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            default -> throw new IllegalArgumentException("Unsupported content type");
        };
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}

record StoredMedia(InputStream content, String contentType, long contentLength) {
}
