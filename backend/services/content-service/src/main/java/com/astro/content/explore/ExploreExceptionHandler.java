package com.astro.content.explore;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice(assignableTypes = {ExplorePublicController.class, ExploreCategoryController.class,
        ExploreAdminController.class, ExploreAdminCategoryController.class})
public class ExploreExceptionHandler {
    @ExceptionHandler(ExploreNotFoundException.class)
    ResponseEntity<ApiError> notFound(ExploreNotFoundException error) {
        return response(HttpStatus.NOT_FOUND, "EXPLORE_ARTICLE_NOT_FOUND", error.getMessage());
    }
    @ExceptionHandler(ExploreConflictException.class)
    ResponseEntity<ApiError> conflict(ExploreConflictException error) {
        return response(HttpStatus.CONFLICT, "EXPLORE_ARTICLE_CONFLICT", error.getMessage());
    }
    @ExceptionHandler({ExploreValidationException.class, ConstraintViolationException.class, MethodArgumentNotValidException.class})
    ResponseEntity<ApiError> invalid(Exception error) {
        return response(HttpStatus.BAD_REQUEST, "EXPLORE_REQUEST_INVALID", error.getMessage());
    }
    private ResponseEntity<ApiError> response(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Instant.now()));
    }
    record ApiError(String code, String message, Instant timestamp) { }
}
