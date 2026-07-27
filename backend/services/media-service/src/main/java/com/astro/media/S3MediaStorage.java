package com.astro.media;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.io.InputStream;

@Service
public class S3MediaStorage implements MediaStorage {
    static final String IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

    private final MediaProperties properties;
    private final S3Client s3Client;

    public S3MediaStorage(MediaProperties properties, S3Client s3Client) {
        this.properties = properties;
        this.s3Client = s3Client;
    }

    @PostConstruct
    void initializeBucket() {
        if (!properties.autoCreateBucket()) return;
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(properties.bucket()).build());
        } catch (S3Exception error) {
            if (error.statusCode() != 404) throw error;
            s3Client.createBucket(CreateBucketRequest.builder().bucket(properties.bucket()).build());
        }
    }

    @Override
    public void put(String mediaId, InputStream content, long contentLength, String contentType) {
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(properties.objectKey(mediaId))
                .contentType(contentType)
                .cacheControl(IMMUTABLE_CACHE_CONTROL)
                .build();
        s3Client.putObject(request, RequestBody.fromInputStream(content, contentLength));
    }

    @Override
    public StoredMedia open(String mediaId) {
        ResponseInputStream<GetObjectResponse> content = s3Client.getObject(GetObjectRequest.builder()
                .bucket(properties.bucket())
                .key(properties.objectKey(mediaId))
                .build());
        GetObjectResponse response = content.response();
        return new StoredMedia(content, response.contentType(), response.contentLength());
    }

    @Override
    public void delete(String mediaId) {
        s3Client.deleteObject(DeleteObjectRequest.builder()
                .bucket(properties.bucket())
                .key(properties.objectKey(mediaId))
                .build());
    }
}
