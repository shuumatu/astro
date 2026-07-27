package com.astro.media;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.io.ByteArrayInputStream;

import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(
        controllers = MediaController.class,
        properties = "astro.security.jwt-secret=0123456789abcdef0123456789abcdef"
)
@Import({MediaSecurityConfiguration.class, MediaExceptionHandler.class})
class MediaControllerTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MediaService mediaService;

    @Test
    void servesMediaPublicly() throws Exception {
        String mediaId = "12345678-1234-1234-1234-123456789012.webp";
        when(mediaService.open(mediaId)).thenReturn(new StoredMedia(
                new ByteArrayInputStream(new byte[]{1, 2, 3}), "image/webp", 3));

        mockMvc.perform(get("/api/media/assets/{mediaId}", mediaId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/webp"))
                .andExpect(content().bytes(new byte[]{1, 2, 3}));
    }

    @Test
    void protectsUploadsWithTheSingleAdminRole() throws Exception {
        mockMvc.perform(multipart("/api/media/assets")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "moon.webp", "image/webp", new byte[]{1, 2, 3}))
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "metadata", "metadata.json", MediaType.APPLICATION_JSON_VALUE,
                                metadataJson())))
                .andExpect(status().isUnauthorized());

        MediaMetadata metadata = new MediaMetadata("Moon", null, null, null);
        when(mediaService.upload(any(), any())).thenReturn(new MediaAsset(
                "12345678-1234-1234-1234-123456789012.webp",
                "/api/media/assets/12345678-1234-1234-1234-123456789012.webp",
                "image/webp", 3, metadata));
        mockMvc.perform(multipart("/api/media/assets")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "moon.webp", "image/webp", new byte[]{1, 2, 3}))
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "metadata", "metadata.json", MediaType.APPLICATION_JSON_VALUE,
                                metadataJson()))
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CONTENT_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mediaId").value("12345678-1234-1234-1234-123456789012.webp"));
    }

    @Test
    void redirectsCompatibilityUrlInDirectDeliveryMode() throws Exception {
        String mediaId = "12345678-1234-1234-1234-123456789012.webp";
        doReturn(true).when(mediaService).usesDirectDelivery();
        when(mediaService.assetUrl(mediaId)).thenReturn("https://media.example.com/" + mediaId);

        mockMvc.perform(get("/api/media/assets/{mediaId}", mediaId))
                .andExpect(status().isFound())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Location", "https://media.example.com/" + mediaId))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Cache-Control", "max-age=3600, public"));
    }

    @Test
    void mapsMissingObjectsToNotFound() throws Exception {
        String mediaId = "12345678-1234-1234-1234-123456789012.webp";
        when(mediaService.open(mediaId)).thenThrow(NoSuchKeyException.builder().message("missing").build());

        mockMvc.perform(get("/api/media/assets/{mediaId}", mediaId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MEDIA_NOT_FOUND"));
    }

    @Test
    void hidesStorageFailureDetails() throws Exception {
        String mediaId = "12345678-1234-1234-1234-123456789012.webp";
        when(mediaService.open(mediaId)).thenThrow(SdkClientException.create("secret endpoint detail"));

        mockMvc.perform(get("/api/media/assets/{mediaId}", mediaId))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("MEDIA_STORAGE_ERROR"))
                .andExpect(jsonPath("$.message").value("Media storage is temporarily unavailable"));
    }

    @Test
    void deletesMediaOnlyForTheAdminRole() throws Exception {
        String mediaId = "12345678-1234-1234-1234-123456789012.webp";

        mockMvc.perform(delete("/api/media/assets/{mediaId}", mediaId))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete("/api/media/assets/{mediaId}", mediaId)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CONTENT_ADMIN"))))
                .andExpect(status().isNoContent());
        org.mockito.Mockito.verify(mediaService).delete(mediaId);
    }

    private byte[] metadataJson() {
        return "{\"altText\":\"Moon\"}".getBytes();
    }
}
