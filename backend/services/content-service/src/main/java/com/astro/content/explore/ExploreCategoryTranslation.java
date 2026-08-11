package com.astro.content.explore;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(name = "explore_category_translation", uniqueConstraints = @UniqueConstraint(columnNames = {"category_id", "locale"}))
public class ExploreCategoryTranslation {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private ExploreCategoryEntity category;
    private String locale;
    private String name;
    private String description;

    protected ExploreCategoryTranslation() { }

    ExploreCategoryTranslation(ExploreCategoryEntity category, String locale, String name, String description) {
        this.id = UUID.randomUUID();
        this.category = category;
        this.locale = locale;
        this.name = name;
        this.description = description;
    }

    void update(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public UUID getId() { return id; }
    public ExploreCategoryEntity getCategory() { return category; }
    public String getLocale() { return locale; }
    public String getName() { return name; }
    public String getDescription() { return description; }
}
