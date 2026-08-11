package com.astro.content.explore;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "explore_source")
public class ExploreSource {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id")
    private ExploreRevision revision;
    private String title;
    private String url;
    private String author;
    private String license;
    private String attribution;
    private int sortOrder;

    protected ExploreSource() { }
    ExploreSource(ExploreRevision revision, ExploreSourceInput input, int order) {
        this.id = UUID.randomUUID(); this.revision = revision; this.title = input.title().trim(); this.url = input.url().trim();
        this.author = blank(input.author()); this.license = blank(input.license()); this.attribution = blank(input.attribution()); this.sortOrder = order;
    }
    ExploreSource(ExploreRevision revision, ExploreSource source) {
        this.id = UUID.randomUUID(); this.revision = revision; this.title = source.title; this.url = source.url;
        this.author = source.author; this.license = source.license; this.attribution = source.attribution; this.sortOrder = source.sortOrder;
    }
    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    public String getTitle() { return title; } public String getUrl() { return url; } public String getAuthor() { return author; }
    public String getLicense() { return license; } public String getAttribution() { return attribution; } public int getSortOrder() { return sortOrder; }
}
