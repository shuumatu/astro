package com.astro.content.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "content_catalog_media_reference")
public class MediaReference {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "translation_id")
    private CatalogTranslation translation;

    private String mediaId;
    private String altText;
    private String caption;
    private String author;
    private String license;
    private String attribution;
    private int sortOrder;

    protected MediaReference() {
    }

    MediaReference(CatalogTranslation translation, MediaInput input, int sortOrder) {
        this.id = UUID.randomUUID();
        this.translation = translation;
        this.mediaId = input.mediaId();
        this.altText = input.altText();
        this.caption = input.caption();
        this.author = input.author();
        this.license = input.license();
        this.attribution = input.attribution();
        this.sortOrder = sortOrder;
    }

    public String getMediaId() { return mediaId; }
    public String getAltText() { return altText; }
    public String getCaption() { return caption; }
    public String getAuthor() { return author; }
    public String getLicense() { return license; }
    public String getAttribution() { return attribution; }
    public int getSortOrder() { return sortOrder; }
}
