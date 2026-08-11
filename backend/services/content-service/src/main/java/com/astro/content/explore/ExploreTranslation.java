package com.astro.content.explore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "explore_translation", uniqueConstraints = @UniqueConstraint(columnNames = {"article_id", "locale"}))
public class ExploreTranslation {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id")
    private ExploreArticle article;
    private String locale;

    @OneToMany(mappedBy = "translation", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExploreRevision> revisions = new ArrayList<>();

    protected ExploreTranslation() { }

    ExploreTranslation(ExploreArticle article, String locale) {
        this.id = UUID.randomUUID();
        this.article = article;
        this.locale = locale;
    }

    ExploreRevision revision(ExploreRevisionStatus status) {
        return revisions.stream().filter(item -> item.getStatus() == status)
                .max(Comparator.comparingInt(ExploreRevision::getRevisionNumber)).orElse(null);
    }

    ExploreRevision draft() { return revision(ExploreRevisionStatus.DRAFT); }
    ExploreRevision published() { return revision(ExploreRevisionStatus.PUBLISHED); }

    ExploreRevision newDraft() {
        ExploreRevision source = published();
        int next = revisions.stream().mapToInt(ExploreRevision::getRevisionNumber).max().orElse(0) + 1;
        ExploreRevision draft = source == null ? new ExploreRevision(this, next) : new ExploreRevision(this, next, source);
        revisions.add(draft);
        return draft;
    }

    ExploreRevision restoreDraft(ExploreRevision source) {
        ExploreRevision current = draft();
        if (current != null) current.supersede();
        int next = revisions.stream().mapToInt(ExploreRevision::getRevisionNumber).max().orElse(0) + 1;
        ExploreRevision restored = new ExploreRevision(this, next, source);
        revisions.add(restored);
        return restored;
    }

    public UUID getId() { return id; }
    public ExploreArticle getArticle() { return article; }
    public String getLocale() { return locale; }
    public List<ExploreRevision> getRevisions() { return revisions; }
}
