package com.astro.astronomy.catalog;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class CatalogExceptionHandler {
    @ExceptionHandler(CatalogUnavailableException.class)
    public ResponseEntity<ApiError> handleUnavailable(CatalogUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError("CATALOG_UNAVAILABLE"));
    }
}
