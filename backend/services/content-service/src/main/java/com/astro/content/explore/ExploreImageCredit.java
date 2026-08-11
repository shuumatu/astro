package com.astro.content.explore;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "explore_image_credit")
public class ExploreImageCredit {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id")
    private ExploreRevision revision;
    private String imageUrl;
    private String sourcePageUrl;
    private String author;
    private String license;
    private String attribution;
    private int sortOrder;

    protected ExploreImageCredit() { }
    ExploreImageCredit(ExploreRevision revision, ExploreImageCreditInput input, int order) {
        this.id = UUID.randomUUID(); this.revision = revision; this.imageUrl = input.imageUrl().trim();
        this.sourcePageUrl = input.sourcePageUrl() == null ? "" : input.sourcePageUrl().trim();
        this.author = blank(input.author()); this.license = blank(input.license()); this.attribution = blank(input.attribution()); this.sortOrder = order;
    }
    ExploreImageCredit(ExploreRevision revision, ExploreImageCredit source) {
        this.id = UUID.randomUUID(); this.revision = revision; this.imageUrl = source.imageUrl; this.sourcePageUrl = source.sourcePageUrl;
        this.author = source.author; this.license = source.license; this.attribution = source.attribution; this.sortOrder = source.sortOrder;
    }
    private static String blank(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    public String getImageUrl() { return imageUrl; } public String getSourcePageUrl() { return sourcePageUrl; }
    public String getAuthor() { return author; } public String getLicense() { return license; }
    public String getAttribution() { return attribution; } public int getSortOrder() { return sortOrder; }
}
