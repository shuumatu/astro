package com.astro.astronomy.catalog;

public class CatalogUnavailableException extends RuntimeException {
    public CatalogUnavailableException(String message) {
        super(message);
    }

    public CatalogUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
