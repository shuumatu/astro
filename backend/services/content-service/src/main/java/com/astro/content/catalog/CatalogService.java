package com.astro.content.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

import static com.astro.content.catalog.CatalogResponses.AdminPage;
import static com.astro.content.catalog.CatalogResponses.AdminSummary;
import static com.astro.content.catalog.CatalogResponses.AdminTranslation;
import static com.astro.content.catalog.CatalogResponses.Entry;
import static com.astro.content.catalog.CatalogResponses.Media;
import static com.astro.content.catalog.CatalogResponses.Source;
import static com.astro.content.catalog.CatalogResponses.Summary;

@Service
public class CatalogService {
    private static final Pattern HTML_TAG = Pattern.compile("<\\/?[A-Za-z][^>]*>");
    private static final Pattern STAR_KEY = Pattern.compile("HIP:[1-9][0-9]*");
    private static final Pattern SOLAR_SYSTEM_KEY = Pattern.compile("solar-system:[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final Pattern CULTURE_FIGURE_KEY = Pattern.compile("culture:[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final Pattern FEATURED_PATTERN_KEY = Pattern.compile("featured-pattern:[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() { };

    private final CatalogEntryRepository repository;
    private final ObjectMapper objectMapper;
    private final MediaUrlProperties mediaUrlProperties;

    public CatalogService(
            CatalogEntryRepository repository,
            ObjectMapper objectMapper,
            MediaUrlProperties mediaUrlProperties
    ) {
        this.repository = repository;
        this.objectMapper = objectMapper;
        this.mediaUrlProperties = mediaUrlProperties;
    }

    @Transactional(readOnly = true)
    public Entry getPublished(CatalogObjectType objectType, String objectKey, String requestedLocale) {
        CatalogEntry entry = findByObject(objectType, objectKey);
        CatalogTranslation translation = resolveTranslation(entry, requestedLocale, true);
        if (translation == null) {
            throw new CatalogNotFoundException("No published catalog content for " + objectKey);
        }
        return response(entry, translation, normalizeLocale(requestedLocale));
    }

    @Transactional(readOnly = true)
    public CatalogResponses.Page listPublished(
            String requestedLocale,
            CatalogObjectType objectType,
            String query,
            int page,
            int size
    ) {
        Page<CatalogEntry> entries = repository.findPublished(
                objectType,
                query == null ? "" : query.trim(),
                PageRequest.of(page, size));
        List<Summary> items = entries.getContent().stream()
                .map(entry -> summary(entry, resolveTranslation(entry, requestedLocale, true)))
                .filter(java.util.Objects::nonNull)
                .toList();
        return new CatalogResponses.Page(items, page, size, entries.getTotalElements(), entries.getTotalPages());
    }

    @Transactional(readOnly = true)
    public AdminPage listAdmin(CatalogObjectType objectType, String query, int page, int size) {
        Page<CatalogEntry> entries = repository.findAdmin(
                objectType,
                query == null ? "" : query.trim(),
                PageRequest.of(page, size));
        List<AdminSummary> items = entries.getContent().stream().map(this::adminSummary).toList();
        return new AdminPage(items, page, size, entries.getTotalElements(), entries.getTotalPages());
    }

    @Transactional
    public AdminSummary create(CreateCatalogEntryRequest request) {
        validateObjectKey(request.objectType(), request.objectKey());
        if (repository.existsByObjectTypeAndObjectKey(request.objectType(), request.objectKey())) {
            throw new CatalogConflictException("A catalog entry already exists for " + request.objectKey());
        }
        return adminSummary(repository.save(new CatalogEntry(request.objectType(), request.objectKey())));
    }

    @Transactional
    public List<String> delete(UUID entryId) {
        CatalogEntry entry = findById(entryId);
        List<String> mediaIds = entry.getTranslations().stream()
                .flatMap(translation -> translation.getMedia().stream())
                .map(MediaReference::getMediaId)
                .distinct()
                .toList();
        repository.delete(entry);
        repository.flush();
        return unreferencedMedia(mediaIds);
    }

    @Transactional(readOnly = true)
    public List<String> unreferencedMedia(List<String> mediaIds) {
        return mediaIds.stream()
                .filter(mediaId -> repository.countMediaReferencesByMediaId(mediaId) == 0)
                .distinct()
                .toList();
    }

    @Transactional
    public Entry updateTranslation(UUID entryId, String locale, UpdateTranslationRequest request) {
        validateRestrictedMarkdown(request.bodyMarkdown());
        CatalogEntry entry = findById(entryId);
        String normalizedLocale = normalizeLocale(locale);
        CatalogTranslation translation = entry.upsertTranslation(normalizedLocale);
        translation.update(
                request.title().trim(),
                request.summary().trim(),
                request.bodyMarkdown().trim(),
                writeKnowledgePoints(request.knowledgePoints()),
                blankToNull(request.imageCaption()),
                request.sources(),
                request.media());
        repository.save(entry);
        return response(entry, translation, normalizedLocale);
    }

    @Transactional(readOnly = true)
    public Entry preview(UUID entryId, String locale) {
        CatalogEntry entry = findById(entryId);
        String normalizedLocale = normalizeLocale(locale);
        CatalogTranslation translation = entry.translation(normalizedLocale);
        if (translation == null) throw new CatalogNotFoundException("Translation not found: " + normalizedLocale);
        return response(entry, translation, normalizedLocale);
    }

    @Transactional
    public Entry publish(UUID entryId, String locale) {
        CatalogEntry entry = findById(entryId);
        String normalizedLocale = normalizeLocale(locale);
        CatalogTranslation translation = entry.translation(normalizedLocale);
        if (translation == null) throw new CatalogNotFoundException("Translation not found: " + normalizedLocale);
        validatePublishable(translation);
        translation.publish();
        repository.save(entry);
        return response(entry, translation, normalizedLocale);
    }

    @Transactional
    public Entry unpublish(UUID entryId, String locale) {
        CatalogEntry entry = findById(entryId);
        String normalizedLocale = normalizeLocale(locale);
        CatalogTranslation translation = entry.translation(normalizedLocale);
        if (translation == null) throw new CatalogNotFoundException("Translation not found: " + normalizedLocale);
        translation.unpublish();
        repository.save(entry);
        return response(entry, translation, normalizedLocale);
    }

    private CatalogEntry findByObject(CatalogObjectType type, String key) {
        return repository.findByObjectTypeAndObjectKey(type, key)
                .orElseThrow(() -> new CatalogNotFoundException("Catalog entry not found: " + key));
    }

    private CatalogEntry findById(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new CatalogNotFoundException("Catalog entry not found: " + id));
    }

    private CatalogTranslation resolveTranslation(CatalogEntry entry, String locale, boolean publishedOnly) {
        for (String candidate : localeCandidates(locale)) {
            CatalogTranslation translation = entry.translation(candidate);
            if (translation != null && (!publishedOnly || translation.getStatus() == PublicationStatus.PUBLISHED)) {
                return translation;
            }
        }
        return null;
    }

    private List<String> localeCandidates(String locale) {
        String normalized = normalizeLocale(locale);
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        candidates.add(normalized);
        Locale parsed = Locale.forLanguageTag(normalized);
        if (!parsed.getLanguage().isBlank()) candidates.add(parsed.getLanguage());
        candidates.add("en");
        return List.copyOf(candidates);
    }

    private String normalizeLocale(String locale) {
        if (locale == null || locale.isBlank()) return "zh-CN";
        String normalized = Locale.forLanguageTag(locale.trim()).toLanguageTag();
        if (normalized.equals("und") || normalized.length() > 35) {
            throw new CatalogValidationException("Invalid locale: " + locale);
        }
        return normalized;
    }

    private Entry response(CatalogEntry entry, CatalogTranslation translation, String requestedLocale) {
        List<Source> sources = translation.getSources().stream()
                .sorted(Comparator.comparingInt(ContentSource::getSortOrder))
                .map(source -> new Source(
                        source.getTitle(), source.getUrl(), source.getAuthor(), source.getLicense(), source.getAttribution()))
                .toList();
        List<Media> media = translation.getMedia().stream()
                .sorted(Comparator.comparingInt(MediaReference::getSortOrder))
                .map(reference -> new Media(
                        reference.getMediaId(),
                        mediaUrlProperties.assetUrl(reference.getMediaId()),
                        reference.getAltText(),
                        reference.getCaption(),
                        reference.getAuthor(),
                        reference.getLicense(),
                        reference.getAttribution()))
                .toList();
        return new Entry(
                entry.getId(),
                entry.getObjectType(),
                entry.getObjectKey(),
                requestedLocale,
                translation.getLocale(),
                !translation.getLocale().equalsIgnoreCase(requestedLocale),
                translation.getStatus(),
                translation.getTitle(),
                translation.getSummary(),
                translation.getBodyMarkdown(),
                readKnowledgePoints(translation.getKnowledgePoints()),
                translation.getImageCaption(),
                sources,
                media,
                translation.getRevision(),
                translation.getPublishedAt(),
                translation.getUpdatedAt());
    }

    private Summary summary(CatalogEntry entry, CatalogTranslation translation) {
        if (translation == null) return null;
        String primaryMediaUrl = translation.getMedia().stream()
                .min(Comparator.comparingInt(MediaReference::getSortOrder))
                .map(reference -> mediaUrlProperties.assetUrl(reference.getMediaId()))
                .orElse(null);
        return new Summary(
                entry.getId(), entry.getObjectType(), entry.getObjectKey(), translation.getLocale(),
                translation.getTitle(), translation.getSummary(), primaryMediaUrl, translation.getUpdatedAt());
    }

    private AdminSummary adminSummary(CatalogEntry entry) {
        List<AdminTranslation> translations = entry.getTranslations().stream()
                .sorted(Comparator.comparing(CatalogTranslation::getLocale))
                .map(translation -> new AdminTranslation(
                        translation.getLocale(), translation.getStatus(), translation.getTitle(), translation.getRevision()))
                .toList();
        return new AdminSummary(
                entry.getId(), entry.getObjectType(), entry.getObjectKey(), entry.getUpdatedAt(), translations);
    }

    private void validateRestrictedMarkdown(String markdown) {
        if (HTML_TAG.matcher(markdown).find()) {
            throw new CatalogValidationException("Raw HTML is not allowed in catalog Markdown");
        }
    }

    private void validateObjectKey(CatalogObjectType objectType, String objectKey) {
        Pattern expected = switch (objectType) {
            case STAR -> STAR_KEY;
            case SOLAR_SYSTEM_BODY -> SOLAR_SYSTEM_KEY;
            case CULTURE_FIGURE -> CULTURE_FIGURE_KEY;
            case FEATURED_PATTERN -> FEATURED_PATTERN_KEY;
        };
        if (!expected.matcher(objectKey).matches()) {
            throw new CatalogValidationException("Object key does not match type " + objectType.value());
        }
    }

    private void validatePublishable(CatalogTranslation translation) {
        List<String> missing = new ArrayList<>();
        if (translation.getTitle().isBlank()) missing.add("title");
        if (translation.getSummary().isBlank()) missing.add("summary");
        if (translation.getBodyMarkdown().isBlank()) missing.add("bodyMarkdown");
        if (!missing.isEmpty()) {
            throw new CatalogValidationException("Cannot publish; missing: " + String.join(", ", missing));
        }
    }

    private List<String> readKnowledgePoints(String value) {
        try {
            return objectMapper.readValue(value, STRING_LIST);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Stored knowledge points are invalid", error);
        }
    }

    private String writeKnowledgePoints(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values.stream().map(String::trim).filter(value -> !value.isBlank()).toList());
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Knowledge points cannot be encoded", error);
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
