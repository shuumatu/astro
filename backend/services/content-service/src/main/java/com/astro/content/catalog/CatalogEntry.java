package com.astro.content.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "content_catalog_entry", uniqueConstraints = @UniqueConstraint(columnNames = {"object_type", "object_key"}))
public class CatalogEntry {
    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    private CatalogObjectType objectType;

    private String objectKey;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToMany(mappedBy = "entry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<CatalogTranslation> translations = new ArrayList<>();

    protected CatalogEntry() {
    }

    public CatalogEntry(CatalogObjectType objectType, String objectKey) {
        this.id = UUID.randomUUID();
        this.objectType = objectType;
        this.objectKey = objectKey;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public CatalogTranslation translation(String locale) {
        return translations.stream()
                .filter(candidate -> candidate.getLocale().equalsIgnoreCase(locale))
                .findFirst()
                .orElse(null);
    }

    public CatalogTranslation upsertTranslation(String locale) {
        CatalogTranslation existing = translation(locale);
        if (existing != null) return existing;
        CatalogTranslation created = new CatalogTranslation(this, locale);
        translations.add(created);
        return created;
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public CatalogObjectType getObjectType() { return objectType; }
    public String getObjectKey() { return objectKey; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<CatalogTranslation> getTranslations() { return translations; }
}
