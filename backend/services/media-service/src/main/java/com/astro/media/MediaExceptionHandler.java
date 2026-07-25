package com.astro.media;

import io.minio.errors.ErrorResponseException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class MediaExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<MediaError> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(new MediaError("MEDIA_INVALID", error.getMessage(), Instant.now()));
    }

    @ExceptionHandler(ErrorResponseException.class)
    ResponseEntity<MediaError> minio(ErrorResponseException error) {
        HttpStatus status = "NoSuchKey".equals(error.errorResponse().code()) ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY;
        return ResponseEntity.status(status)
                .body(new MediaError("MEDIA_STORAGE_ERROR", error.errorResponse().message(), Instant.now()));
    }
}

record MediaError(String code, String message, Instant timestamp) {
}
