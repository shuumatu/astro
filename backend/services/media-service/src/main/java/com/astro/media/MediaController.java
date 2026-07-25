package com.astro.media;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.concurrent.TimeUnit;

@Validated
@RestController
@RequestMapping("/api/media/assets")
public class MediaController {
    private final MediaStorage mediaStorage;

    public MediaController(MediaStorage mediaStorage) {
        this.mediaStorage = mediaStorage;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CONTENT_ADMIN')")
    public MediaAsset upload(
            @RequestPart("file") MultipartFile file,
            @Valid @RequestPart("metadata") MediaMetadata metadata
    ) throws Exception {
        return mediaStorage.upload(file, metadata);
    }

    @GetMapping("/{mediaId}")
    public ResponseEntity<InputStreamResource> content(
            @PathVariable("mediaId") @Pattern(regexp = "[0-9a-fA-F-]{36}\\.(jpg|png|webp)") String mediaId
    ) throws Exception {
        StoredMedia media = mediaStorage.open(mediaId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(media.contentType()))
                .contentLength(media.contentLength())
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .body(new InputStreamResource(media.content()));
    }
}

record MediaMetadata(
        @NotBlank @Size(max = 500) String altText,
        @Size(max = 240) String author,
        @Size(max = 160) String license,
        @Size(max = 500) String attribution
) {
}

record MediaAsset(
        String mediaId,
        String url,
        String contentType,
        long size,
        MediaMetadata metadata
) {
}
