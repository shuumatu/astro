package com.astro.content.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateTranslationRequest(
        @NotNull @Size(max = 160) String title,
        @NotNull @Size(max = 600) String summary,
        @NotNull @Size(max = 50000) String bodyMarkdown,
        @NotNull @Size(max = 20) List<@Size(max = 500) String> knowledgePoints,
        @Size(max = 500) String imageCaption,
        @NotNull @Size(max = 30) List<@Valid SourceInput> sources,
        @NotNull @Size(max = 20) List<@Valid MediaInput> media
) {
}
