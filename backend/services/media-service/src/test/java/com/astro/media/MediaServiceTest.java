package com.astro.media;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.net.URI;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class MediaServiceTest {
    private MediaStorage storage;
    private MediaService service;

    @BeforeEach
    void setUp() {
        storage = mock(MediaStorage.class);
        MediaProperties properties = new MediaProperties(
                URI.create("http://localhost:9000"), "us-east-1", "key", "secret", "media",
                "catalog", true, true, MediaProperties.DeliveryMode.PROXY, "/api/media/assets/");
        service = new MediaService(properties, storage);
    }

    @ParameterizedTest
    @MethodSource("validImages")
    void acceptsSupportedImages(String contentType, String extension, byte[] bytes) throws Exception {
        MediaMetadata metadata = new MediaMetadata("星云图像", "作者", null, null);
        AtomicReference<byte[]> uploaded = new AtomicReference<>();
        doAnswer(invocation -> {
            uploaded.set(((InputStream) invocation.getArgument(1)).readAllBytes());
            return null;
        }).when(storage).put(any(), any(InputStream.class), any(Long.class), any());

        MediaAsset asset = service.upload(file(contentType, bytes), metadata);

        assertThat(asset.mediaId()).endsWith(extension);
        assertThat(asset.url()).isEqualTo("/api/media/assets/" + asset.mediaId());
        assertThat(asset.metadata()).isEqualTo(metadata);
        assertThat(uploaded.get()).containsExactly(bytes);
        verify(storage).put(eq(asset.mediaId()), any(InputStream.class), eq((long) bytes.length), eq(contentType));
    }

    @Test
    void rejectsADeclaredTypeThatDoesNotMatchTheBytes() {
        assertThatThrownBy(() -> service.upload(file("image/png", new byte[]{1, 2, 3, 4}), metadata()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("do not match");
    }

    @Test
    void rejectsEmptyAndOversizedFiles() {
        assertThatThrownBy(() -> service.upload(file("image/jpeg", new byte[0]), metadata()))
                .isInstanceOf(IllegalArgumentException.class);
        MockMultipartFile oversized = mock(MockMultipartFile.class);
        org.mockito.Mockito.when(oversized.getContentType()).thenReturn("image/jpeg");
        org.mockito.Mockito.when(oversized.getSize()).thenReturn(MediaService.MAX_FILE_SIZE + 1);
        assertThatThrownBy(() -> service.upload(oversized, metadata()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Stream<Arguments> validImages() {
        return Stream.of(
                Arguments.of("image/jpeg", ".jpg", new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff, 0}),
                Arguments.of("image/png", ".png", new byte[]{
                        (byte) 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}),
                Arguments.of("image/webp", ".webp", new byte[]{
                        'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}));
    }

    private MockMultipartFile file(String contentType, byte[] bytes) {
        return new MockMultipartFile("file", "image", contentType, bytes);
    }

    private MediaMetadata metadata() {
        return new MediaMetadata("Image", null, null, null);
    }
}
