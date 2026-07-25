package com.astro.content.catalog;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CatalogResponses {
    private CatalogResponses() {
    }

    public record Source(
            String title,
            String url,
            String author,
            String license,
            String attribution
    ) {
    }

    public record Media(
            String mediaId,
            String url,
            String altText,
            String caption,
            String author,
            String license,
            String attribution
    ) {
    }

    public record Entry(
            UUID id,
            CatalogObjectType objectType,
            String objectKey,
            String requestedLocale,
            String contentLocale,
            boolean localeFallback,
            PublicationStatus status,
            String title,
            String summary,
            String bodyMarkdown,
            List<String> knowledgePoints,
            String imageCaption,
            List<Source> sources,
            List<Media> media,
            int revision,
            Instant publishedAt,
            Instant updatedAt
    ) {
    }

    public record Summary(
            UUID id,
            CatalogObjectType objectType,
            String objectKey,
            String contentLocale,
            String title,
            String summary,
            String primaryMediaUrl,
            Instant updatedAt
    ) {
    }

    public record Page(List<Summary> items, int page, int size, long totalElements, int totalPages) {
    }

    public record AdminSummary(
            UUID id,
            CatalogObjectType objectType,
            String objectKey,
            Instant updatedAt,
            List<AdminTranslation> translations
    ) {
    }

    public record AdminTranslation(String locale, PublicationStatus status, String title, int revision) {
    }

    public record AdminPage(List<AdminSummary> items, int page, int size, long totalElements, int totalPages) {
    }
}
