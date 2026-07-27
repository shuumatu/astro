package com.astro.media;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.time.Instant;

@RestControllerAdvice
public class MediaExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(MediaExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<MediaError> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(new MediaError("MEDIA_INVALID", error.getMessage(), Instant.now()));
    }

    @ExceptionHandler(NoSuchKeyException.class)
    ResponseEntity<MediaError> missing(NoSuchKeyException error) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new MediaError("MEDIA_NOT_FOUND", "Media object was not found", Instant.now()));
    }

    @ExceptionHandler(S3Exception.class)
    ResponseEntity<MediaError> s3(S3Exception error) {
        if (error.statusCode() == 404) return missing(null);
        log.warn("S3-compatible media storage request failed with status {} and code {}",
                error.statusCode(), error.awsErrorDetails() == null ? null : error.awsErrorDetails().errorCode());
        return storageUnavailable();
    }

    @ExceptionHandler(SdkClientException.class)
    ResponseEntity<MediaError> client(SdkClientException error) {
        log.warn("S3-compatible media storage client failed", error);
        return storageUnavailable();
    }

    private ResponseEntity<MediaError> storageUnavailable() {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new MediaError("MEDIA_STORAGE_ERROR", "Media storage is temporarily unavailable", Instant.now()));
    }
}

record MediaError(String code, String message, Instant timestamp) {
}
