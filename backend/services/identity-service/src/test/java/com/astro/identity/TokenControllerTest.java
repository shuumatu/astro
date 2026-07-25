package com.astro.identity;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "astro.identity.admin-username=test-admin",
        "astro.identity.admin-password=test-password",
        "astro.identity.jwt-secret=0123456789abcdef0123456789abcdef"
})
@AutoConfigureMockMvc
class TokenControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @Test
    void issuesAContentAdminTokenForTheConfiguredAdmin() throws Exception {
        mockMvc.perform(post("/api/identity/token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"test-admin","password":"test-password"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.roles[0]").value("CONTENT_ADMIN"));
    }

    @Test
    void rejectsInvalidCredentials() throws Exception {
        mockMvc.perform(post("/api/identity/token")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"test-admin","password":"wrong"}
                                """))
                .andExpect(status().isUnauthorized());
    }
}
