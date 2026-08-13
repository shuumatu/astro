package com.astro.content.explore;

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
@Table(name = "explore_revision", uniqueConstraints = @UniqueConstraint(columnNames = {"translation_id", "revision_number"}))
public class ExploreRevision {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "translation_id")
    private ExploreTranslation translation;
    private int revisionNumber;
    @Enumerated(EnumType.STRING) private ExploreRevisionStatus status;
    private String title;
    private String summary;
    private String bodyMarkdown;
    private String tags;
    private int estimatedMinutes;
    private String coverImageUrl;
    private String coverImageAlt;
    private String coverImageCaption;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant publishedAt;

    @OneToMany(mappedBy = "revision", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExploreSource> sources = new ArrayList<>();
    @OneToMany(mappedBy = "revision", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExploreImageCredit> imageCredits = new ArrayList<>();

    protected ExploreRevision() { }

    ExploreRevision(ExploreTranslation translation, int revisionNumber) {
        this.id = UUID.randomUUID();
        this.translation = translation;
        this.revisionNumber = revisionNumber;
        this.status = ExploreRevisionStatus.DRAFT;
        this.title = "";
        this.summary = "";
        this.bodyMarkdown = "";
        this.tags = "[]";
        this.estimatedMinutes = 5;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    ExploreRevision(ExploreTranslation translation, int revisionNumber, ExploreRevision source) {
        this(translation, revisionNumber);
        this.title = source.title;
        this.summary = source.summary;
        this.bodyMarkdown = source.bodyMarkdown;
        this.tags = source.tags;
        this.estimatedMinutes = source.estimatedMinutes;
        this.coverImageUrl = source.coverImageUrl;
        this.coverImageAlt = source.coverImageAlt;
        this.coverImageCaption = source.coverImageCaption;
        for (ExploreSource item : source.sources) this.sources.add(new ExploreSource(this, item));
        for (ExploreImageCredit item : source.imageCredits) this.imageCredits.add(new ExploreImageCredit(this, item));
    }

    void update(ExploreRequests.SaveDraft input, String tagsJson) {
        title = input.title().trim();
        summary = input.summary().trim();
        bodyMarkdown = input.bodyMarkdown().replace("\r\n", "\n").trim();
        tags = tagsJson;
        estimatedMinutes = input.estimatedMinutes();
        coverImageUrl = blankToNull(input.coverImageUrl());
        coverImageAlt = blankToNull(input.coverImageAlt());
        coverImageCaption = blankToNull(input.coverImageCaption());
        sources.clear();
        for (int i = 0; i < input.sources().size(); i++) sources.add(new ExploreSource(this, input.sources().get(i), i));
        imageCredits.clear();
        for (int i = 0; i < input.imageCredits().size(); i++) imageCredits.add(new ExploreImageCredit(this, input.imageCredits().get(i), i));
        updatedAt = Instant.now();
    }

    void initializeTitle(String title) {
        this.title = title.trim();
        this.updatedAt = Instant.now();
    }

    void publish() { status = ExploreRevisionStatus.PUBLISHED; publishedAt = Instant.now(); updatedAt = publishedAt; }
    void supersede() { status = ExploreRevisionStatus.SUPERSEDED; updatedAt = Instant.now(); }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    public UUID getId() { return id; }
    public ExploreTranslation getTranslation() { return translation; }
    public int getRevisionNumber() { return revisionNumber; }
    public ExploreRevisionStatus getStatus() { return status; }
    public String getTitle() { return title; }
    public String getSummary() { return summary; }
    public String getBodyMarkdown() { return bodyMarkdown; }
    public String getTags() { return tags; }
    public int getEstimatedMinutes() { return estimatedMinutes; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public String getCoverImageAlt() { return coverImageAlt; }
    public String getCoverImageCaption() { return coverImageCaption; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public List<ExploreSource> getSources() { return sources; }
    public List<ExploreImageCredit> getImageCredits() { return imageCredits; }
}
