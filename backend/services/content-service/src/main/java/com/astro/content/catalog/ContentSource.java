package com.astro.content.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "content_catalog_source")
public class ContentSource {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "translation_id")
    private CatalogTranslation translation;

    private String title;
    private String url;
    private String author;
    private String license;
    private String attribution;
    private int sortOrder;

    protected ContentSource() {
    }

    ContentSource(CatalogTranslation translation, SourceInput input, int sortOrder) {
        this.id = UUID.randomUUID();
        this.translation = translation;
        this.title = input.title();
        this.url = input.url();
        this.author = input.author();
        this.license = input.license();
        this.attribution = input.attribution();
        this.sortOrder = sortOrder;
    }

    public String getTitle() { return title; }
    public String getUrl() { return url; }
    public String getAuthor() { return author; }
    public String getLicense() { return license; }
    public String getAttribution() { return attribution; }
    public int getSortOrder() { return sortOrder; }
}
