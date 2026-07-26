package com.astro.content.catalog;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class CatalogApiIntegrationTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void returnsPublishedChineseContentAndRevalidatesWithAnEtag() throws Exception {
        MvcResult first = mockMvc.perform(get("/api/content/catalog-entries/star/HIP:91262")
                        .queryParam("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("织女星"))
                .andExpect(jsonPath("$.contentLocale").value("zh-CN"))
                .andExpect(jsonPath("$.localeFallback").value(false))
                .andExpect(jsonPath("$.sources[0].title").value("IAU Catalog of Star Names"))
                .andExpect(header().exists("ETag"))
                .andReturn();
        assertThat(objectMapper.readTree(first.getResponse().getContentAsByteArray()).path("bodyMarkdown").asText())
                .contains("\n\n")
                .doesNotContain("\\n");

        mockMvc.perform(get("/api/content/catalog-entries/star/HIP:91262")
                        .queryParam("locale", "zh-CN")
                        .header("If-None-Match", first.getResponse().getHeader("ETag")))
                .andExpect(status().isNotModified());
    }

    @Test
    void fallsBackToEnglishAndListsPublishedEntries() throws Exception {
        mockMvc.perform(get("/api/content/catalog-entries/solar-system-body/solar-system:moon")
                        .queryParam("locale", "fr-FR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Moon"))
                .andExpect(jsonPath("$.contentLocale").value("en"))
                .andExpect(jsonPath("$.localeFallback").value(true));

        mockMvc.perform(get("/api/content/catalog-entries")
                        .queryParam("locale", "en")
                        .queryParam("objectType", "culture-figure")
                        .queryParam("query", "Lyra"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].objectKey").value("culture:western-iau:constellation-lyr"));
    }

    @Test
    void keepsDraftsPrivateAndAllowsTheSingleAdminToPublishWithoutSources() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"star","objectKey":"HIP:12345"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode createdBody = objectMapper.readTree(created.getResponse().getContentAsByteArray());
        String entryId = createdBody.path("id").asText();

        mockMvc.perform(put("/api/content/admin/catalog-entries/{entryId}/translations/en", entryId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"Test star",
                                  "summary":"A test catalog entry.",
                                  "bodyMarkdown":"A short **Markdown** article.",
                                  "knowledgePoints":["One point"],
                                  "imageCaption":null,
                                  "sources":[],
                                  "media":[]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"));

        mockMvc.perform(get("/api/content/catalog-entries/star/HIP:12345").queryParam("locale", "en"))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/content/admin/catalog-entries/{entryId}/translations/en/publish", entryId)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        mockMvc.perform(get("/api/content/catalog-entries/star/HIP:12345").queryParam("locale", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sources.length()").value(0));
    }

    @Test
    void allowsFeaturedPatternsToBeWrittenAndPublished() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"featured-pattern","objectKey":"featured-pattern:summer-triangle"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objectType").value("featured-pattern"))
                .andReturn();
        String entryId = objectMapper.readTree(created.getResponse().getContentAsByteArray()).path("id").asText();

        mockMvc.perform(put("/api/content/admin/catalog-entries/{entryId}/translations/zh-CN", entryId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"夏季大三角",
                                  "summary":"由织女星、河鼓二和天津四组成的醒目星群。",
                                  "bodyMarkdown":"夏季夜空中的经典辨识图形。",
                                  "knowledgePoints":["三个顶点都是亮星"],
                                  "imageCaption":null,
                                  "sources":[],
                                  "media":[]
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"));

        mockMvc.perform(post("/api/content/admin/catalog-entries/{entryId}/translations/zh-CN/publish", entryId)
                        .with(adminJwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        mockMvc.perform(get("/api/content/catalog-entries/featured-pattern/featured-pattern:summer-triangle")
                        .queryParam("locale", "zh-CN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objectType").value("featured-pattern"))
                .andExpect(jsonPath("$.title").value("夏季大三角"));
    }

    @Test
    void filtersAdminEntriesAndDeletesAnEntry() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"star","objectKey":"HIP:654321"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String entryId = objectMapper.readTree(created.getResponse().getContentAsByteArray()).path("id").asText();

        mockMvc.perform(get("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .queryParam("objectType", "star")
                        .queryParam("query", "654321"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].objectKey").value("HIP:654321"));

        mockMvc.perform(delete("/api/content/admin/catalog-entries/{entryId}", entryId)
                        .with(adminJwt()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .queryParam("query", "654321"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void rejectsObjectKeysThatDoNotMatchTheirType() throws Exception {
        mockMvc.perform(post("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"featured-pattern","objectKey":"HIP:91262"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CATALOG_REQUEST_INVALID"));
    }

    @Test
    void protectsAdminRoutesAndRejectsRawHtml() throws Exception {
        mockMvc.perform(get("/api/content/admin/catalog-entries"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/content/admin/catalog-entries")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_READER"))))
                .andExpect(status().isForbidden());

        MvcResult created = mockMvc.perform(post("/api/content/admin/catalog-entries")
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"star","objectKey":"HIP:54321"}
                                """))
                .andExpect(status().isOk())
                .andReturn();
        String entryId = objectMapper.readTree(created.getResponse().getContentAsByteArray()).path("id").asText();

        mockMvc.perform(put("/api/content/admin/catalog-entries/{entryId}/translations/en", entryId)
                        .with(adminJwt())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title":"Unsafe",
                                  "summary":"Unsafe body",
                                  "bodyMarkdown":"<script>alert(1)</script>",
                                  "knowledgePoints":[],
                                  "imageCaption":null,
                                  "sources":[],
                                  "media":[]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CATALOG_REQUEST_INVALID"));
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor adminJwt() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_CONTENT_ADMIN"));
    }
}
