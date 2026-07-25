package com.astro.content.catalog;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class CatalogExceptionHandler {
    @ExceptionHandler(CatalogNotFoundException.class)
    ResponseEntity<ApiError> notFound(CatalogNotFoundException error) {
        return error(HttpStatus.NOT_FOUND, "CATALOG_ENTRY_NOT_FOUND", error.getMessage());
    }

    @ExceptionHandler(CatalogConflictException.class)
    ResponseEntity<ApiError> conflict(CatalogConflictException error) {
        return error(HttpStatus.CONFLICT, "CATALOG_ENTRY_CONFLICT", error.getMessage());
    }

    @ExceptionHandler({
            CatalogValidationException.class,
            IllegalArgumentException.class,
            ConstraintViolationException.class,
            MethodArgumentNotValidException.class
    })
    ResponseEntity<ApiError> invalid(Exception error) {
        return error(HttpStatus.BAD_REQUEST, "CATALOG_REQUEST_INVALID", error.getMessage());
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Instant.now()));
    }
}

record ApiError(String code, String message, Instant timestamp) {
}
