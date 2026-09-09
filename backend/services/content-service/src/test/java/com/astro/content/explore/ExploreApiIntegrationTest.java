package com.astro.content.explore;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "astro.media.public-base-url=https://media.example.com/",
        "astro.media.key-prefix=catalog",
        "astro.media.delivery-mode=direct"
})
@AutoConfigureMockMvc
class ExploreApiIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @Test
    void keepsPublishedRevisionStableAndRestoresHistory() throws Exception {
        String id = create("moon-phases-guide");
        save(id, "zh-CN", draft("Moon phases", "First published summary",
                "## How phases work\n\nPhases depend on the viewing angle.\n\n"
                        + "![Moon phases](https://images.example.com/moon.webp \"Lunar cycle\")", true));

        mockMvc.perform(get("/api/content/explore/articles/moon-phases-guide")).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/publish", id).with(adminJwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));

        MvcResult published = mockMvc.perform(get("/api/content/explore/articles/moon-phases-guide")
                        .queryParam("locale", "zh-CN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Moon phases"))
                .andExpect(jsonPath("$.imageCredits[0].sourcePageUrl").value("https://science.example.com/moon"))
                .andExpect(header().exists("ETag")).andReturn();

        save(id, "zh-CN", draft("Moon phases", "Unpublished second summary",
                "## New content\n\nThe public article should not change yet.", false));
        mockMvc.perform(get("/api/content/explore/articles/moon-phases-guide").queryParam("locale", "zh-CN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary").value("First published summary"));

        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/publish", id).with(adminJwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary").value("Unpublished second summary"));
        MvcResult revisions = mockMvc.perform(get("/api/content/admin/explore/articles/{id}/translations/zh-CN/revisions", id)
                        .with(adminJwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("PUBLISHED"))
                .andExpect(jsonPath("$[1].status").value("SUPERSEDED")).andReturn();
        String previousId = objectMapper.readTree(revisions.getResponse().getContentAsByteArray())
                .get(1).path("id").asText();
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/revisions/{revisionId}/restore",
                        id, previousId).with(adminJwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.summary").value("First published summary"));

        mockMvc.perform(get("/api/content/explore/articles/moon-phases-guide")
                        .header("If-None-Match", published.getResponse().getHeader("ETag")))
                .andExpect(status().isOk());
    }

    @Test
    void validatesMarkdownImagesAndPublicationCredits() throws Exception {
        String id = create("unsafe-image-test");
        mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/en", id).with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draft("Unsafe", "Summary", "![bad](http://example.com/a.png)", false)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("EXPLORE_REQUEST_INVALID"));

        for (String unsafeUrl : java.util.List.of("data:image/png;base64,abc", "javascript:alert(1)")) {
            mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/en", id).with(adminJwt())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(draft("Unsafe", "Summary", "![bad](" + unsafeUrl + ")", false)))
                    .andExpect(status().isBadRequest());
        }

        mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/en", id).with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draft("Unsafe", "Summary", "<script>alert(1)</script>", false)))
                .andExpect(status().isBadRequest());

        save(id, "en", draft("Missing alt", "Summary", "![](https://images.example.com/a.png)", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/publish", id).with(adminJwt()))
                .andExpect(status().isBadRequest());

        save(id, "en", draft("Missing credit", "Summary", "![A star](https://images.example.com/a.png)", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/publish", id).with(adminJwt()))
                .andExpect(status().isBadRequest());

        String nullCredit = objectMapper.writeValueAsString(Map.of(
                "title", "Nullable source page",
                "summary", "Summary",
                "bodyMarkdown", "![A star](https://images.example.com/a.png)",
                "tags", java.util.List.of("astronomy"),
                "estimatedMinutes", 5,
                "sources", java.util.List.of(),
                "imageCredits", java.util.List.of(new java.util.HashMap<>(Map.of(
                        "imageUrl", "https://images.example.com/a.png")))
        ));
        mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/en", id).with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON).content(nullCredit))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imageCredits[0].sourcePageUrl").value(""));

        String tooManyImages = java.util.stream.IntStream.range(0, 31)
                .mapToObj(index -> "![Image " + index + "](https://images.example.com/" + index + ".png)")
                .collect(java.util.stream.Collectors.joining("\n\n"));
        mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/en", id).with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(draft("Too many images", "Summary", tooManyImages, false)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void publishesWithoutSummaryButStillRequiresTitleAndBody() throws Exception {
        String id = create("optional-summary-test");
        save(id, "zh-CN", draft("Meteor showers", "", "## Origins\n\nComets leave streams of debris.", false));

        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/publish", id).with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.summary").value(""));

        String missingTitleId = create("missing-title-test");
        save(missingTitleId, "zh-CN", draft("", "", "## Body\n\nPresent.", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/publish", missingTitleId).with(adminJwt()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Title and body are required for publishing"));

        String missingBodyId = create("missing-body-test");
        save(missingBodyId, "zh-CN", draft("Title", "", "", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/zh-CN/publish", missingBodyId).with(adminJwt()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Title and body are required for publishing"));
    }

    @Test
    void listsFiltersFallsBackAndArchivesArticles() throws Exception {
        String id = create("telescope-basics");
        save(id, "en", draft("Telescope basics", "How telescopes collect light",
                "## Aperture\n\nBigger apertures collect more light.", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/publish", id).with(adminJwt()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/content/explore/articles").queryParam("locale", "fr-FR")
                        .queryParam("category", "UNIVERSE").queryParam("query", "Telescope"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].contentLocale").value("en"))
                .andExpect(jsonPath("$.items[0].slug").value("telescope-basics"));

        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/archive", id).with(adminJwt()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/content/explore/articles/telescope-basics")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/content/admin/explore/articles").with(adminJwt()).queryParam("status", "ARCHIVED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].archived").value(true));

        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/restore", id).with(adminJwt()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(false));
        mockMvc.perform(get("/api/content/explore/articles/telescope-basics")).andExpect(status().isOk());

        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/unpublish", id).with(adminJwt()))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/content/explore/articles/telescope-basics")).andExpect(status().isNotFound());
    }

    @Test
    void managesLocalizedCategoriesWithoutBreakingExistingArticles() throws Exception {
        String categoryPayload = objectMapper.writeValueAsString(Map.of(
                "code", "INSTRUMENTS", "sortOrder", 25,
                "translations", java.util.List.of(
                        Map.of("locale", "zh-CN", "name", "观测仪器", "description", "望远镜与探测器"),
                        Map.of("locale", "en", "name", "Instruments", "description", "Telescopes and detectors"))));
        MvcResult createdCategory = mockMvc.perform(post("/api/content/admin/explore/categories").with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON).content(categoryPayload))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("INSTRUMENTS")).andReturn();
        String categoryId = objectMapper.readTree(createdCategory.getResponse().getContentAsByteArray()).path("id").asText();

        mockMvc.perform(get("/api/content/explore/categories").queryParam("locale", "zh-CN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.code == 'INSTRUMENTS')].name").value("观测仪器"));

        MvcResult article = mockMvc.perform(post("/api/content/admin/explore/articles").with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"instrument-category-test\",\"category\":\"INSTRUMENTS\",\"locale\":\"zh-CN\",\"title\":\"观测仪器\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("INSTRUMENTS"))
                .andExpect(jsonPath("$.translations[0].title").value("观测仪器")).andReturn();

        String disabledPayload = objectMapper.writeValueAsString(Map.of(
                "sortOrder", 25, "enabled", false,
                "translations", java.util.List.of(
                        Map.of("locale", "zh-CN", "name", "天文仪器", "description", "望远镜与探测器"),
                        Map.of("locale", "en", "name", "Instruments", "description", "Telescopes and detectors"))));
        mockMvc.perform(put("/api/content/admin/explore/categories/{id}", categoryId).with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON).content(disabledPayload))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        mockMvc.perform(get("/api/content/explore/categories").queryParam("locale", "zh-CN"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.code == 'INSTRUMENTS')].enabled").value(false))
                .andExpect(jsonPath("$[?(@.code == 'INSTRUMENTS')].name").value("天文仪器"));

        mockMvc.perform(post("/api/content/admin/explore/articles").with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"disabled-category-test\",\"category\":\"INSTRUMENTS\",\"locale\":\"en\",\"title\":\"Disabled\"}"))
                .andExpect(status().isBadRequest());
        String articleId = objectMapper.readTree(article.getResponse().getContentAsByteArray()).path("id").asText();
        mockMvc.perform(get("/api/content/admin/explore/articles").with(adminJwt()).queryParam("category", "INSTRUMENTS"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[?(@.id == '" + articleId + "')].category").value("INSTRUMENTS"));
    }

    @Test
    void importsExportedMarkdownAsDraftWithoutChangingPublishedRevision() throws Exception {
        String id = create("markdown-round-trip");
        save(id, "en", draft("Round trip", "Published summary", "## Original\n\nPublished body.", false));
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/publish", id).with(adminJwt()))
                .andExpect(status().isOk());

        MvcResult exported = mockMvc.perform(get("/api/content/admin/explore/articles/{id}/translations/en/markdown", id)
                        .with(adminJwt()).accept("text/markdown"))
                .andExpect(status().isOk()).andExpect(header().string("Content-Type", org.hamcrest.Matchers.startsWith("text/markdown")))
                .andReturn();
        String markdown = exported.getResponse().getContentAsString().replace("Published summary", "Imported draft summary");
        mockMvc.perform(post("/api/content/admin/explore/articles/{id}/translations/en/markdown", id).with(adminJwt())
                        .contentType("text/markdown;charset=UTF-8").content(markdown))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.summary").value("Imported draft summary"));

        mockMvc.perform(get("/api/content/explore/articles/markdown-round-trip").queryParam("locale", "en"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.summary").value("Published summary"));
    }

    private String create(String slug) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/content/admin/explore/articles").with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slug\":\"%s\",\"category\":\"UNIVERSE\",\"locale\":\"zh-CN\",\"title\":\"New article\"}"
                                .formatted(slug)))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsByteArray()).path("id").asText();
    }

    private void save(String id, String locale, String body) throws Exception {
        mockMvc.perform(put("/api/content/admin/explore/articles/{id}/translations/{locale}", id, locale)
                        .with(adminJwt()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
    }

    private String draft(String title, String summary, String markdown, boolean credited) throws Exception {
        Map<String, Object> payload = Map.of(
                "title", title,
                "summary", summary,
                "bodyMarkdown", markdown,
                "tags", java.util.List.of("astronomy"),
                "estimatedMinutes", 5,
                "sources", java.util.List.of(),
                "imageCredits", credited
                        ? java.util.List.of(Map.of(
                                "imageUrl", "https://images.example.com/moon.webp",
                                "sourcePageUrl", "https://science.example.com/moon",
                                "author", "Example",
                                "license", "CC BY",
                                "attribution", "Example Observatory"))
                        : java.util.List.of()
        );
        return objectMapper.writeValueAsString(payload);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor adminJwt() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_CONTENT_ADMIN"));
    }
}
