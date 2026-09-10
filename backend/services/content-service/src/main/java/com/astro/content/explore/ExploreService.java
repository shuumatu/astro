package com.astro.content.explore;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class ExploreService {
    private static final Pattern SLUG = Pattern.compile("[a-z0-9]+(?:-[a-z0-9]+)*");
    private static final Pattern CATEGORY_CODE = Pattern.compile("[A-Z0-9]+(?:_[A-Z0-9]+)*");
    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() { };

    private final ExploreArticleRepository repository;
    private final ExploreCategoryRepository categoryRepository;
    private final ExploreMarkdownAnalyzer markdownAnalyzer;
    private final ExploreMarkdownDocumentService markdownDocuments;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public ExploreService(ExploreArticleRepository repository, ExploreCategoryRepository categoryRepository,
                          ExploreMarkdownAnalyzer markdownAnalyzer, ExploreMarkdownDocumentService markdownDocuments,
                          ObjectMapper objectMapper, Validator validator) {
        this.repository = repository;
        this.categoryRepository = categoryRepository;
        this.markdownAnalyzer = markdownAnalyzer;
        this.markdownDocuments = markdownDocuments;
        this.objectMapper = objectMapper;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public ExploreResponses.Page listPublished(String locale, String category, String query, int page, int size) {
        var result = repository.findPublished(normalizeCategory(category), cleanQuery(query), PageRequest.of(page, size));
        List<ExploreResponses.Summary> items = result.getContent().stream()
                .map(article -> summary(article, resolvePublished(article, locale)))
                .filter(java.util.Objects::nonNull).toList();
        return new ExploreResponses.Page(items, page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public ExploreResponses.Article getPublished(String slug, String locale) {
        ExploreArticle article = findBySlug(slug);
        if (article.getArchivedAt() != null) throw new ExploreNotFoundException("Explore article not found: " + slug);
        ExploreRevision revision = resolvePublished(article, locale);
        if (revision == null) throw new ExploreNotFoundException("No published explore article for " + slug);
        List<ExploreResponses.Summary> related = repository
                .findPublished(article.getCategory().getCode(), "", PageRequest.of(0, 4)).getContent().stream()
                .filter(candidate -> !candidate.getId().equals(article.getId()))
                .map(candidate -> summary(candidate, resolvePublished(candidate, locale)))
                .filter(java.util.Objects::nonNull).limit(3).toList();
        return response(article, revision, normalizeLocale(locale), related);
    }

    @Transactional(readOnly = true)
    public ExploreResponses.AdminPage listAdmin(String category, String status, String query, int page, int size) {
        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("", "DRAFT", "PUBLISHED", "ARCHIVED").contains(normalizedStatus)) {
            throw new ExploreValidationException("Unknown explore status: " + status);
        }
        var result = repository.findAdmin(normalizeCategory(category), normalizedStatus, cleanQuery(query), PageRequest.of(page, size));
        return new ExploreResponses.AdminPage(result.getContent().stream().map(this::adminSummary).toList(),
                page, size, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public ExploreResponses.AdminSummary create(ExploreRequests.CreateArticle request) {
        String slug = request.slug().trim();
        if (!SLUG.matcher(slug).matches()) throw new ExploreValidationException("Slug must use lowercase kebab-case");
        if (repository.existsBySlug(slug)) throw new ExploreConflictException("Explore article already exists: " + slug);
        ExploreCategoryEntity category = requireCategory(request.category(), true);
        ExploreArticle article = new ExploreArticle(slug, category);
        ExploreRevision draft = article.upsertTranslation(normalizeLocale(request.locale())).newDraft();
        draft.initializeTitle(request.title());
        return adminSummary(repository.save(article));
    }

    @Transactional
    public ExploreResponses.AdminSummary updateMetadata(UUID id, ExploreRequests.UpdateMetadata request) {
        ExploreArticle article = findById(id);
        String slug = request.slug().trim();
        if (!SLUG.matcher(slug).matches()) throw new ExploreValidationException("Slug must use lowercase kebab-case");
        if (repository.existsBySlugAndIdNot(slug, id)) {
            throw new ExploreConflictException("Explore article already exists: " + slug);
        }
        article.updateMetadata(slug, requireCategory(request.category(), true));
        return adminSummary(repository.save(article));
    }

    @Transactional
    public ExploreResponses.Article saveDraft(UUID id, String locale, ExploreRequests.SaveDraft request) {
        ExploreMarkdownAnalyzer.Analysis analysis = validateDraft(request);
        ExploreArticle article = findById(id);
        String normalizedLocale = normalizeLocale(locale);
        ExploreTranslation translation = article.upsertTranslation(normalizedLocale);
        ExploreRevision draft = translation.draft();
        if (draft == null) draft = translation.newDraft();
        draft.update(request, writeTags(request.tags()));
        article.touch();
        repository.save(article);
        return response(article, draft, normalizedLocale, List.of());
    }

    @Transactional(readOnly = true)
    public ExploreResponses.Article preview(UUID id, String locale) {
        ExploreArticle article = findById(id);
        String normalizedLocale = normalizeLocale(locale);
        ExploreTranslation translation = article.translation(normalizedLocale);
        if (translation == null) throw new ExploreNotFoundException("Explore translation not found: " + normalizedLocale);
        ExploreRevision revision = translation.draft() != null ? translation.draft() : translation.published();
        if (revision == null) throw new ExploreNotFoundException("Explore translation has no revision: " + normalizedLocale);
        return response(article, revision, normalizedLocale, List.of());
    }

    @Transactional
    public ExploreResponses.Article publish(UUID id, String locale) {
        ExploreArticle article = findById(id);
        String normalizedLocale = normalizeLocale(locale);
        ExploreTranslation translation = article.translation(normalizedLocale);
        if (translation == null || translation.draft() == null) throw new ExploreNotFoundException("Explore draft not found: " + normalizedLocale);
        ExploreRevision draft = translation.draft();
        validatePublishable(draft);
        ExploreRevision published = translation.published();
        if (published != null) published.supersede();
        draft.publish();
        article.markPublished();
        repository.save(article);
        return response(article, draft, normalizedLocale, List.of());
    }

    @Transactional
    public void unpublish(UUID id, String locale) {
        ExploreArticle article = findById(id);
        ExploreTranslation translation = article.translation(normalizeLocale(locale));
        if (translation == null || translation.published() == null) throw new ExploreNotFoundException("Published explore translation not found");
        translation.published().supersede();
        article.touch();
        repository.save(article);
    }

    @Transactional
    public ExploreResponses.AdminSummary setArchived(UUID id, boolean archived) {
        ExploreArticle article = findById(id);
        if (archived) article.archive(); else article.restore();
        return adminSummary(repository.save(article));
    }

    @Transactional(readOnly = true)
    public List<ExploreResponses.Revision> revisions(UUID id, String locale) {
        ExploreArticle article = findById(id);
        ExploreTranslation translation = article.translation(normalizeLocale(locale));
        if (translation == null) return List.of();
        return translation.getRevisions().stream()
                .sorted(Comparator.comparingInt(ExploreRevision::getRevisionNumber).reversed())
                .map(item -> new ExploreResponses.Revision(item.getId(), item.getRevisionNumber(), item.getStatus(),
                        item.getTitle(), item.getUpdatedAt(), item.getPublishedAt())).toList();
    }

    @Transactional
    public ExploreResponses.Article restoreRevision(UUID id, String locale, UUID revisionId) {
        ExploreArticle article = findById(id);
        String normalizedLocale = normalizeLocale(locale);
        ExploreTranslation translation = article.translation(normalizedLocale);
        if (translation == null) throw new ExploreNotFoundException("Explore translation not found");
        ExploreRevision source = translation.getRevisions().stream().filter(item -> item.getId().equals(revisionId)).findFirst()
                .orElseThrow(() -> new ExploreNotFoundException("Explore revision not found: " + revisionId));
        ExploreRevision draft = translation.restoreDraft(source);
        article.touch();
        repository.save(article);
        return response(article, draft, normalizedLocale, List.of());
    }

    @Transactional(readOnly = true)
    public List<ExploreResponses.Category> listCategories(String locale, boolean includeDisabled) {
        String normalizedLocale = normalizeLocale(locale);
        return categoryRepository.findAllForExplore(includeDisabled).stream()
                .map(item -> new ExploreResponses.Category(item.getId(), item.getCode(), item.nameFor(normalizedLocale),
                        item.descriptionFor(normalizedLocale), item.getSortOrder(), item.isEnabled()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ExploreResponses.AdminCategory> listAdminCategories() {
        return categoryRepository.findAllForExplore(true).stream().map(this::adminCategory).toList();
    }

    @Transactional
    public ExploreResponses.AdminCategory createCategory(ExploreRequests.CreateCategory request) {
        String code = normalizeCategoryCode(request.code());
        if (categoryRepository.existsByCodeIgnoreCase(code)) {
            throw new ExploreConflictException("Explore category already exists: " + code);
        }
        ExploreCategoryEntity category = new ExploreCategoryEntity(code, request.sortOrder());
        applyCategoryTranslations(category, request.translations());
        return adminCategory(categoryRepository.save(category));
    }

    @Transactional
    public ExploreResponses.AdminCategory updateCategory(UUID id, ExploreRequests.UpdateCategory request) {
        ExploreCategoryEntity category = categoryRepository.findById(id)
                .orElseThrow(() -> new ExploreNotFoundException("Explore category not found: " + id));
        category.update(category.getCode(), request.sortOrder(), request.enabled());
        applyCategoryTranslations(category, request.translations());
        return adminCategory(categoryRepository.save(category));
    }

    @Transactional(readOnly = true)
    public String exportMarkdown(UUID id, String locale) {
        ExploreResponses.Article article = preview(id, locale);
        return markdownDocuments.write(article);
    }

    @Transactional(readOnly = true)
    public String markdownFilename(UUID id, String locale) {
        return findById(id).getSlug() + "-" + normalizeLocale(locale) + ".md";
    }

    @Transactional
    public ExploreResponses.Article importMarkdown(UUID id, String locale, String document) {
        ExploreRequests.SaveDraft draft = markdownDocuments.read(document);
        var violations = validator.validate(draft);
        if (!violations.isEmpty()) {
            String message = violations.stream().map(item -> item.getPropertyPath() + " " + item.getMessage())
                    .sorted().findFirst().orElse("Invalid Markdown document");
            throw new ExploreValidationException(message);
        }
        return saveDraft(id, locale, draft);
    }

    private ExploreMarkdownAnalyzer.Analysis validateDraft(ExploreRequests.SaveDraft request) {
        ExploreMarkdownAnalyzer.Analysis analysis = markdownAnalyzer.analyze(request.bodyMarkdown());
        markdownAnalyzer.requireHttps(request.coverImageUrl(), "Cover image URL");
        request.sources().forEach(source -> requireAbsoluteUrl(source.url(), "Source URL"));
        Set<String> creditUrls = new LinkedHashSet<>();
        request.imageCredits().forEach(credit -> {
            markdownAnalyzer.requireHttps(credit.imageUrl(), "Image credit URL");
            if (credit.sourcePageUrl() != null && !credit.sourcePageUrl().isBlank()) {
                requireAbsoluteUrl(credit.sourcePageUrl(), "Image source page URL");
            }
            if (!creditUrls.add(credit.imageUrl().trim())) throw new ExploreValidationException("Duplicate image credit: " + credit.imageUrl());
        });
        return analysis;
    }

    private void validatePublishable(ExploreRevision revision) {
        if (revision.getTitle().isBlank() || revision.getBodyMarkdown().isBlank()) {
            throw new ExploreValidationException("Title and body are required for publishing");
        }
        ExploreMarkdownAnalyzer.Analysis analysis = markdownAnalyzer.analyze(revision.getBodyMarkdown());
        Set<String> requiredCredits = new LinkedHashSet<>();
        for (ExploreMarkdownAnalyzer.MarkdownImage image : analysis.images()) {
            if (image.alt().isBlank()) throw new ExploreValidationException("Every Markdown image requires alt text");
            requiredCredits.add(image.url());
        }
        if (revision.getCoverImageUrl() != null) {
            if (revision.getCoverImageAlt() == null || revision.getCoverImageAlt().isBlank()) {
                throw new ExploreValidationException("The cover image requires alt text");
            }
            requiredCredits.add(revision.getCoverImageUrl());
        }
        Set<String> credited = revision.getImageCredits().stream()
                .filter(item -> item.getSourcePageUrl() != null && !item.getSourcePageUrl().isBlank())
                .map(ExploreImageCredit::getImageUrl).collect(java.util.stream.Collectors.toSet());
        requiredCredits.removeAll(credited);
        if (!requiredCredits.isEmpty()) throw new ExploreValidationException("Missing image credits for: " + String.join(", ", requiredCredits));
    }

    private ExploreRevision resolvePublished(ExploreArticle article, String locale) {
        for (String candidate : localeCandidates(locale)) {
            ExploreTranslation translation = article.translation(candidate);
            if (translation != null && translation.published() != null) return translation.published();
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
        if (normalized.equals("und") || normalized.length() > 35) throw new ExploreValidationException("Invalid locale: " + locale);
        return normalized;
    }

    private ExploreResponses.Article response(ExploreArticle article, ExploreRevision revision, String requestedLocale,
                                              List<ExploreResponses.Summary> related) {
        List<ExploreResponses.Source> sources = revision.getSources().stream().sorted(Comparator.comparingInt(ExploreSource::getSortOrder))
                .map(item -> new ExploreResponses.Source(item.getTitle(), item.getUrl(), item.getAuthor(), item.getLicense(), item.getAttribution())).toList();
        List<ExploreResponses.ImageCredit> credits = revision.getImageCredits().stream().sorted(Comparator.comparingInt(ExploreImageCredit::getSortOrder))
                .map(item -> new ExploreResponses.ImageCredit(item.getImageUrl(), item.getSourcePageUrl(), item.getAuthor(), item.getLicense(), item.getAttribution())).toList();
        String contentLocale = revision.getTranslation().getLocale();
        return new ExploreResponses.Article(article.getId(), article.getSlug(), article.getCategory().getCode(),
                requestedLocale, contentLocale, !contentLocale.equalsIgnoreCase(requestedLocale), revision.getTitle(), revision.getSummary(),
                revision.getBodyMarkdown(), readTags(revision.getTags()), revision.getEstimatedMinutes(), revision.getCoverImageUrl(),
                revision.getCoverImageAlt(), revision.getCoverImageCaption(), sources, credits, revision.getRevisionNumber(),
                revision.getStatus(), revision.getPublishedAt(), revision.getUpdatedAt(), related);
    }

    private ExploreResponses.Summary summary(ExploreArticle article, ExploreRevision revision) {
        if (revision == null) return null;
        return new ExploreResponses.Summary(article.getId(), article.getSlug(), article.getCategory().getCode(),
                revision.getTranslation().getLocale(), revision.getTitle(), revision.getSummary(), readTags(revision.getTags()),
                revision.getEstimatedMinutes(), revision.getCoverImageUrl(), revision.getCoverImageAlt(), revision.getPublishedAt(), revision.getUpdatedAt());
    }

    private ExploreResponses.AdminSummary adminSummary(ExploreArticle article) {
        List<ExploreResponses.AdminTranslation> translations = article.getTranslations().stream()
                .sorted(Comparator.comparing(ExploreTranslation::getLocale)).map(item -> {
                    ExploreRevision draft = item.draft(); ExploreRevision published = item.published();
                    ExploreRevision display = draft != null ? draft : published;
                    return new ExploreResponses.AdminTranslation(item.getLocale(), draft == null ? null : draft.getRevisionNumber(),
                            published == null ? null : published.getRevisionNumber(), display == null ? "" : display.getTitle());
                }).toList();
        return new ExploreResponses.AdminSummary(article.getId(), article.getSlug(), article.getCategory().getCode(),
                article.getArchivedAt() != null, article.getUpdatedAt(), translations);
    }

    private ExploreResponses.AdminCategory adminCategory(ExploreCategoryEntity category) {
        List<ExploreResponses.CategoryTranslation> translations = category.orderedTranslations().stream()
                .map(item -> new ExploreResponses.CategoryTranslation(item.getLocale(), item.getName(), item.getDescription()))
                .toList();
        return new ExploreResponses.AdminCategory(category.getId(), category.getCode(), category.getSortOrder(),
                category.isEnabled(), translations, category.getUpdatedAt());
    }

    private void applyCategoryTranslations(ExploreCategoryEntity category,
                                           List<ExploreRequests.CategoryTranslation> translations) {
        Set<String> locales = new LinkedHashSet<>();
        for (ExploreRequests.CategoryTranslation translation : translations) {
            String locale = normalizeLocale(translation.locale());
            if (!locales.add(locale.toLowerCase(Locale.ROOT))) {
                throw new ExploreValidationException("Duplicate category locale: " + locale);
            }
            category.addTranslation(locale, translation.name().trim(),
                    translation.description() == null || translation.description().isBlank()
                            ? null : translation.description().trim());
        }
        category.retainTranslations(locales);
    }

    private ExploreCategoryEntity requireCategory(String category, boolean requireEnabled) {
        String code = normalizeCategoryCode(category);
        ExploreCategoryEntity result = categoryRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ExploreValidationException("Unknown explore category: " + category));
        if (requireEnabled && !result.isEnabled()) {
            throw new ExploreValidationException("Explore category is disabled: " + code);
        }
        return result;
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) return null;
        return requireCategory(category, false).getCode();
    }

    private String normalizeCategoryCode(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORY_CODE.matcher(normalized).matches()) {
            throw new ExploreValidationException("Category code must use uppercase snake case");
        }
        return normalized;
    }

    private ExploreArticle findById(UUID id) { return repository.findById(id).orElseThrow(() -> new ExploreNotFoundException("Explore article not found: " + id)); }
    private ExploreArticle findBySlug(String slug) { return repository.findBySlug(slug).orElseThrow(() -> new ExploreNotFoundException("Explore article not found: " + slug)); }
    private String cleanQuery(String query) { return query == null ? "" : query.trim(); }

    private String writeTags(List<String> tags) {
        try { return objectMapper.writeValueAsString(tags.stream().map(String::trim).distinct().toList()); }
        catch (JsonProcessingException error) { throw new IllegalStateException("Unable to encode explore tags", error); }
    }
    private List<String> readTags(String tags) {
        try { return objectMapper.readValue(tags, STRING_LIST); }
        catch (JsonProcessingException error) { throw new IllegalStateException("Unable to decode explore tags", error); }
    }
    private void requireAbsoluteUrl(String value, String field) {
        try { URI uri = URI.create(value.trim()); if (uri.getScheme() == null || uri.getHost() == null) throw new IllegalArgumentException(); }
        catch (IllegalArgumentException error) { throw new ExploreValidationException(field + " must be an absolute URL"); }
    }
}
