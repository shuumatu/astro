package com.astro.content.catalog;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "content_catalog_translation", uniqueConstraints = @UniqueConstraint(columnNames = {"entry_id", "locale"}))
public class CatalogTranslation {
    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "entry_id")
    private CatalogEntry entry;

    private String locale;

    @Enumerated(EnumType.STRING)
    private PublicationStatus status;

    private String title;
    private String summary;
    private String bodyMarkdown;
    private String knowledgePoints;
    private String imageCaption;
    private int revision;
    private Instant publishedAt;
    private Instant updatedAt;

    @OneToMany(mappedBy = "translation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ContentSource> sources = new ArrayList<>();

    @OneToMany(mappedBy = "translation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MediaReference> media = new ArrayList<>();

    protected CatalogTranslation() {
    }

    CatalogTranslation(CatalogEntry entry, String locale) {
        this.id = UUID.randomUUID();
        this.entry = entry;
        this.locale = locale;
        this.status = PublicationStatus.DRAFT;
        this.title = "";
        this.summary = "";
        this.bodyMarkdown = "";
        this.knowledgePoints = "[]";
        this.revision = 1;
        this.updatedAt = Instant.now();
    }

    public void update(
            String title,
            String summary,
            String bodyMarkdown,
            String knowledgePoints,
            String imageCaption,
            List<SourceInput> sourceInputs,
            List<MediaInput> mediaInputs
    ) {
        this.title = title;
        this.summary = summary;
        this.bodyMarkdown = bodyMarkdown;
        this.knowledgePoints = knowledgePoints;
        this.imageCaption = imageCaption;
        this.revision += 1;
        this.updatedAt = Instant.now();
        this.sources.clear();
        for (int index = 0; index < sourceInputs.size(); index++) {
            this.sources.add(new ContentSource(this, sourceInputs.get(index), index));
        }
        this.media.clear();
        for (int index = 0; index < mediaInputs.size(); index++) {
            this.media.add(new MediaReference(this, mediaInputs.get(index), index));
        }
        entry.touch();
    }

    public void publish() {
        status = PublicationStatus.PUBLISHED;
        publishedAt = Instant.now();
        updatedAt = publishedAt;
        revision += 1;
        entry.touch();
    }

    public void unpublish() {
        status = PublicationStatus.DRAFT;
        publishedAt = null;
        updatedAt = Instant.now();
        revision += 1;
        entry.touch();
    }

    public UUID getId() { return id; }
    public CatalogEntry getEntry() { return entry; }
    public String getLocale() { return locale; }
    public PublicationStatus getStatus() { return status; }
    public String getTitle() { return title; }
    public String getSummary() { return summary; }
    public String getBodyMarkdown() { return bodyMarkdown; }
    public String getKnowledgePoints() { return knowledgePoints; }
    public String getImageCaption() { return imageCaption; }
    public int getRevision() { return revision; }
    public Instant getPublishedAt() { return publishedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<ContentSource> getSources() { return sources; }
    public List<MediaReference> getMedia() { return media; }
}
