package com.astro.media;

import java.io.InputStream;

public interface MediaStorage {
    void put(String mediaId, InputStream content, long contentLength, String contentType);

    StoredMedia open(String mediaId);

    void delete(String mediaId);
}

record StoredMedia(InputStream content, String contentType, long contentLength) implements AutoCloseable {
    @Override
    public void close() throws Exception {
        content.close();
    }
}
