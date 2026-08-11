package com.astro.content.explore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "explore_category")
public class ExploreCategoryEntity {
    @Id private UUID id;
    private String code;
    private boolean enabled;
    private int sortOrder;
    private Instant createdAt;
    private Instant updatedAt;

    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<ExploreCategoryTranslation> translations = new ArrayList<>();

    protected ExploreCategoryEntity() { }

    ExploreCategoryEntity(String code, int sortOrder) {
        this.id = UUID.randomUUID();
        this.code = code.trim().toUpperCase(Locale.ROOT);
        this.enabled = true;
        this.sortOrder = sortOrder;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    void update(String code, int sortOrder, boolean enabled) {
        this.code = code.trim().toUpperCase(Locale.ROOT);
        this.sortOrder = sortOrder;
        this.enabled = enabled;
        this.updatedAt = Instant.now();
    }

    void addTranslation(String locale, String name, String description) {
        ExploreCategoryTranslation existing = translations.stream()
                .filter(item -> item.getLocale().equalsIgnoreCase(locale)).findFirst().orElse(null);
        if (existing != null) {
            existing.update(name, description);
            updatedAt = Instant.now();
            return;
        }
        translations.add(new ExploreCategoryTranslation(this, locale, name, description));
        updatedAt = Instant.now();
    }

    void retainTranslations(Set<String> locales) {
        translations.removeIf(item -> !locales.contains(item.getLocale().toLowerCase(Locale.ROOT)));
        updatedAt = Instant.now();
    }

    String nameFor(String locale) {
        ExploreCategoryTranslation selected = translationFor(locale);
        return selected == null ? code : selected.getName();
    }

    String descriptionFor(String locale) {
        ExploreCategoryTranslation selected = translationFor(locale);
        return selected == null ? null : selected.getDescription();
    }

    private ExploreCategoryTranslation translationFor(String locale) {
        ExploreCategoryTranslation exact = translations.stream()
                .filter(item -> item.getLocale().equalsIgnoreCase(locale))
                .findFirst()
                .orElse(null);
        if (exact != null) return exact;
        String language = Locale.forLanguageTag(locale).getLanguage();
        ExploreCategoryTranslation sameLanguage = translations.stream()
                .filter(item -> Locale.forLanguageTag(item.getLocale()).getLanguage().equalsIgnoreCase(language))
                .findFirst().orElse(null);
        if (sameLanguage != null) return sameLanguage;
        return translations.stream().filter(item -> item.getLocale().equalsIgnoreCase("en")).findFirst().orElse(null);
    }

    List<ExploreCategoryTranslation> orderedTranslations() {
        return translations.stream().sorted(Comparator.comparing(ExploreCategoryTranslation::getLocale)).toList();
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public boolean isEnabled() { return enabled; }
    public int getSortOrder() { return sortOrder; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<ExploreCategoryTranslation> getTranslations() { return translations; }
}
