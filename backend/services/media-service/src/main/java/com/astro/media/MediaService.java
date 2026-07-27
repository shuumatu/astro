package com.astro.media;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MediaService {
    static final long MAX_FILE_SIZE = 8L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private final MediaProperties properties;
    private final MediaStorage storage;

    public MediaService(MediaProperties properties, MediaStorage storage) {
        this.properties = properties;
        this.storage = storage;
    }

    public MediaAsset upload(MultipartFile file, MediaMetadata metadata) throws IOException {
        String contentType = file.getContentType();
        if (file.isEmpty() || file.getSize() > MAX_FILE_SIZE
                || contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only non-empty JPEG, PNG, and WebP images are accepted");
        }
        byte[] content = file.getBytes();
        verifySignature(content, contentType);
        String mediaId = UUID.randomUUID() + EXTENSIONS.get(contentType);
        try (InputStream input = new ByteArrayInputStream(content)) {
            storage.put(mediaId, input, content.length, contentType);
        }
        return new MediaAsset(mediaId, properties.assetUrl(mediaId), contentType, content.length, metadata);
    }

    public StoredMedia open(String mediaId) {
        return storage.open(mediaId);
    }

    public void delete(String mediaId) {
        storage.delete(mediaId);
    }

    public boolean usesDirectDelivery() {
        return properties.deliveryMode() == MediaProperties.DeliveryMode.DIRECT;
    }

    public String assetUrl(String mediaId) {
        return properties.assetUrl(mediaId);
    }

    private void verifySignature(byte[] content, String contentType) {
        byte[] header = content.length <= 12 ? content : java.util.Arrays.copyOf(content, 12);
        boolean valid = switch (contentType) {
            case "image/jpeg" -> header.length >= 3
                    && unsigned(header[0]) == 0xff && unsigned(header[1]) == 0xd8 && unsigned(header[2]) == 0xff;
            case "image/png" -> header.length >= 8
                    && unsigned(header[0]) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G'
                    && unsigned(header[4]) == 0x0d && unsigned(header[5]) == 0x0a
                    && unsigned(header[6]) == 0x1a && unsigned(header[7]) == 0x0a;
            case "image/webp" -> header.length >= 12
                    && ascii(header, 0, "RIFF") && ascii(header, 8, "WEBP");
            default -> false;
        };
        if (!valid) throw new IllegalArgumentException("File contents do not match the declared image type");
    }

    private boolean ascii(byte[] bytes, int offset, String expected) {
        for (int index = 0; index < expected.length(); index++) {
            if (bytes[offset + index] != expected.charAt(index)) return false;
        }
        return true;
    }

    private int unsigned(byte value) {
        return value & 0xff;
    }
}
