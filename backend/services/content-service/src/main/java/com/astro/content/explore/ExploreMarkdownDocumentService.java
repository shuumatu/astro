package com.astro.content.explore;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLGenerator;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ExploreMarkdownDocumentService {
    private static final String DELIMITER = "---";
    private final ObjectMapper yamlMapper = new ObjectMapper(
            YAMLFactory.builder().disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER).build())
            .findAndRegisterModules();

    public String write(ExploreResponses.Article article) {
        FrontMatter metadata = new FrontMatter(
                article.title(), article.summary(), article.tags(), article.estimatedMinutes(),
                article.coverImageUrl(), article.coverImageAlt(), article.coverImageCaption(),
                article.sources(), article.imageCredits());
        try {
            return DELIMITER + "\n" + yamlMapper.writeValueAsString(metadata)
                    + DELIMITER + "\n\n" + article.bodyMarkdown().stripLeading();
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Unable to export explore Markdown", error);
        }
    }

    public ExploreRequests.SaveDraft read(String document) {
        if (document == null || document.length() > 150000 || !document.startsWith(DELIMITER + "\n")) {
            throw new ExploreValidationException("Markdown import requires YAML front matter");
        }
        int closing = document.indexOf("\n" + DELIMITER + "\n", DELIMITER.length() + 1);
        if (closing < 0) throw new ExploreValidationException("Markdown front matter is not closed");
        String yaml = document.substring(DELIMITER.length() + 1, closing);
        String body = document.substring(closing + DELIMITER.length() + 2).stripLeading();
        try {
            FrontMatter metadata = yamlMapper.readValue(yaml, FrontMatter.class);
            if (metadata == null) throw new ExploreValidationException("Markdown front matter is empty");
            return new ExploreRequests.SaveDraft(
                    value(metadata.title()), value(metadata.summary()), body,
                    metadata.tags() == null ? List.of() : metadata.tags(), metadata.estimatedMinutes(),
                    blankToNull(metadata.coverImageUrl()), blankToNull(metadata.coverImageAlt()),
                    blankToNull(metadata.coverImageCaption()),
                    metadata.sources() == null ? List.of() : metadata.sources().stream()
                            .map(item -> new ExploreSourceInput(item.title(), item.url(), item.author(), item.license(), item.attribution())).toList(),
                    metadata.imageCredits() == null ? List.of() : metadata.imageCredits().stream()
                            .map(item -> new ExploreImageCreditInput(item.imageUrl(), item.sourcePageUrl(), item.author(), item.license(), item.attribution())).toList());
        } catch (JsonProcessingException error) {
            throw new ExploreValidationException("Invalid Markdown front matter: " + error.getOriginalMessage());
        } catch (IllegalArgumentException error) {
            throw new ExploreValidationException("Invalid Markdown front matter: " + error.getMessage());
        }
    }

    private String value(String value) { return value == null ? "" : value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }

    private record FrontMatter(
            String title, String summary, List<String> tags, int estimatedMinutes,
            String coverImageUrl, String coverImageAlt, String coverImageCaption,
            List<ExploreResponses.Source> sources, List<ExploreResponses.ImageCredit> imageCredits
    ) { }
}
