package com.astro.content.explore;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ExploreResponses {
    private ExploreResponses() { }

    public record Source(String title, String url, String author, String license, String attribution) { }
    public record ImageCredit(String imageUrl, String sourcePageUrl, String author, String license, String attribution) { }
    public record CategoryTranslation(String locale, String name, String description) { }
    public record Category(UUID id, String code, String name, String description, int sortOrder, boolean enabled) { }
    public record AdminCategory(UUID id, String code, int sortOrder, boolean enabled,
                                List<CategoryTranslation> translations, Instant updatedAt) { }

    public record Summary(
            UUID id, String slug, String category, ExploreDifficulty difficulty,
            String contentLocale, String title, String summary, List<String> tags, int estimatedMinutes,
            String coverImageUrl, String coverImageAlt, Instant publishedAt, Instant updatedAt
    ) { }

    public record Article(
            UUID id, String slug, String category, ExploreDifficulty difficulty,
            String requestedLocale, String contentLocale, boolean localeFallback,
            String title, String summary, String bodyMarkdown, List<String> tags, int estimatedMinutes,
            String coverImageUrl, String coverImageAlt, String coverImageCaption,
            List<Source> sources, List<ImageCredit> imageCredits,
            int revision, ExploreRevisionStatus status, Instant publishedAt, Instant updatedAt,
            List<Summary> relatedArticles
    ) { }

    public record Page(List<Summary> items, int page, int size, long totalElements, int totalPages) { }
    public record AdminTranslation(String locale, Integer draftRevision, Integer publishedRevision, String title) { }
    public record AdminSummary(UUID id, String slug, String category, ExploreDifficulty difficulty,
                               boolean archived, Instant updatedAt, List<AdminTranslation> translations) { }
    public record AdminPage(List<AdminSummary> items, int page, int size, long totalElements, int totalPages) { }
    public record Revision(UUID id, int revision, ExploreRevisionStatus status, String title, Instant updatedAt, Instant publishedAt) { }
}
