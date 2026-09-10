package com.astro.content.explore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "explore_article")
public class ExploreArticle {
    @Id private UUID id;
    private String slug;
    @jakarta.persistence.ManyToOne(fetch = jakarta.persistence.FetchType.LAZY, optional = false)
    @jakarta.persistence.JoinColumn(name = "category_id") private ExploreCategoryEntity category;
    private Instant archivedAt;
    private Instant lastPublishedAt;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToMany(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExploreTranslation> translations = new ArrayList<>();

    protected ExploreArticle() { }

    ExploreArticle(String slug, ExploreCategoryEntity category) {
        this.id = UUID.randomUUID();
        this.slug = slug;
        this.category = category;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    ExploreTranslation translation(String locale) {
        return translations.stream().filter(item -> item.getLocale().equalsIgnoreCase(locale)).findFirst().orElse(null);
    }

    ExploreTranslation upsertTranslation(String locale) {
        ExploreTranslation existing = translation(locale);
        if (existing != null) return existing;
        ExploreTranslation created = new ExploreTranslation(this, locale);
        translations.add(created);
        return created;
    }

    void updateMetadata(String slug, ExploreCategoryEntity category) {
        this.slug = slug;
        this.category = category;
        touch();
    }

    void archive() { archivedAt = Instant.now(); touch(); }
    void restore() { archivedAt = null; touch(); }
    void markPublished() { lastPublishedAt = Instant.now(); touch(); }
    void touch() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public String getSlug() { return slug; }
    public ExploreCategoryEntity getCategory() { return category; }
    public Instant getArchivedAt() { return archivedAt; }
    public Instant getLastPublishedAt() { return lastPublishedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<ExploreTranslation> getTranslations() { return translations; }
}
