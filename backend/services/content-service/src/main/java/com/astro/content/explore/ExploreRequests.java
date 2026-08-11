package com.astro.content.explore;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class ExploreRequests {
    private ExploreRequests() { }

    public record CreateArticle(
            @NotBlank @Size(min = 3, max = 120) String slug,
            @NotBlank @Size(max = 64) String category,
            @NotNull ExploreDifficulty difficulty
    ) { }

    public record UpdateMetadata(
            @NotBlank @Size(max = 64) String category,
            @NotNull ExploreDifficulty difficulty
    ) { }

    public record CategoryTranslation(
            @NotBlank @Size(max = 35) String locale,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 500) String description
    ) { }

    public record CreateCategory(
            @NotBlank @Size(min = 2, max = 64) String code,
            @Min(0) @Max(100000) int sortOrder,
            @NotNull @Size(min = 1, max = 20) List<@Valid CategoryTranslation> translations
    ) { }

    public record UpdateCategory(
            @Min(0) @Max(100000) int sortOrder,
            boolean enabled,
            @NotNull @Size(min = 1, max = 20) List<@Valid CategoryTranslation> translations
    ) { }

    public record SaveDraft(
            @NotNull @Size(max = 160) String title,
            @NotNull @Size(max = 600) String summary,
            @NotNull @Size(max = 100000) String bodyMarkdown,
            @NotNull @Size(max = 12) List<@NotBlank @Size(max = 50) String> tags,
            @Min(1) @Max(60) int estimatedMinutes,
            @Size(max = 2048) String coverImageUrl,
            @Size(max = 500) String coverImageAlt,
            @Size(max = 500) String coverImageCaption,
            @NotNull @Size(max = 30) List<@Valid ExploreSourceInput> sources,
            @NotNull @Size(max = 31) List<@Valid ExploreImageCreditInput> imageCredits
    ) { }
}
