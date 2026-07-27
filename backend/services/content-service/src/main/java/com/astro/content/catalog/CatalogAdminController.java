package com.astro.content.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.UUID;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/content/admin/catalog-entries")
@PreAuthorize("hasRole('CONTENT_ADMIN')")
public class CatalogAdminController {
    private final CatalogService catalogService;

    public CatalogAdminController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public CatalogResponses.AdminPage list(
            @RequestParam(name = "objectType", required = false) String objectType,
            @RequestParam(name = "query", defaultValue = "") @Size(max = 120) String query,
            @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(name = "size", defaultValue = "50") @Min(1) @Max(100) int size
    ) {
        CatalogObjectType type = objectType == null || objectType.isBlank()
                ? null
                : CatalogObjectType.fromValue(objectType);
        return catalogService.listAdmin(type, query, page, size);
    }

    @PostMapping
    public CatalogResponses.AdminSummary create(@Valid @RequestBody CreateCatalogEntryRequest request) {
        return catalogService.create(request);
    }

    @PostMapping("/media/unreferenced")
    public List<String> findUnreferencedMedia(@Valid @RequestBody MediaReleaseRequest request) {
        return catalogService.unreferencedMedia(request.mediaIds());
    }

    @PutMapping("/{entryId}/translations/{locale}")
    public CatalogResponses.Entry updateTranslation(
            @PathVariable("entryId") UUID entryId,
            @PathVariable("locale") String locale,
            @Valid @RequestBody UpdateTranslationRequest request
    ) {
        return catalogService.updateTranslation(entryId, locale, request);
    }

    @GetMapping("/{entryId}/translations/{locale}/preview")
    public CatalogResponses.Entry preview(
            @PathVariable("entryId") UUID entryId,
            @PathVariable("locale") String locale
    ) {
        return catalogService.preview(entryId, locale);
    }

    @PostMapping("/{entryId}/translations/{locale}/publish")
    public CatalogResponses.Entry publish(
            @PathVariable("entryId") UUID entryId,
            @PathVariable("locale") String locale
    ) {
        return catalogService.publish(entryId, locale);
    }

    @PostMapping("/{entryId}/translations/{locale}/unpublish")
    public CatalogResponses.Entry unpublish(
            @PathVariable("entryId") UUID entryId,
            @PathVariable("locale") String locale
    ) {
        return catalogService.unpublish(entryId, locale);
    }

    @DeleteMapping("/{entryId}")
    public List<String> delete(@PathVariable("entryId") UUID entryId) {
        return catalogService.delete(entryId);
    }
}
