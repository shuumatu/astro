package com.astro.content.catalog;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/content/catalog-entries")
public class CatalogPublicController {
    private final CatalogService catalogService;

    public CatalogPublicController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public CatalogResponses.Page list(
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale,
            @RequestParam(name = "objectType", required = false) String objectType,
            @RequestParam(name = "query", defaultValue = "") @Size(max = 120) String query,
            @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(50) int size
    ) {
        CatalogObjectType type = objectType == null || objectType.isBlank()
                ? null
                : CatalogObjectType.fromValue(objectType);
        return catalogService.listPublished(locale, type, query, page, size);
    }

    @GetMapping("/{objectType}/{objectKey}")
    public ResponseEntity<CatalogResponses.Entry> detail(
            @PathVariable("objectType") String objectType,
            @PathVariable("objectKey") String objectKey,
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch
    ) {
        CatalogResponses.Entry entry = catalogService.getPublished(
                CatalogObjectType.fromValue(objectType), objectKey, locale);
        String etag = "\"catalog-" + entry.id() + "-" + entry.contentLocale() + "-" + entry.revision() + "\"";
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(304).eTag(etag).cacheControl(CacheControl.noCache()).build();
        }
        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(CacheControl.noCache())
                .body(entry);
    }
}
