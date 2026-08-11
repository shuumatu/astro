package com.astro.content.explore;

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
@RequestMapping("/api/content/explore/articles")
public class ExplorePublicController {
    private final ExploreService service;
    public ExplorePublicController(ExploreService service) { this.service = service; }

    @GetMapping
    public ExploreResponses.Page list(
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale,
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "query", defaultValue = "") @Size(max = 120) String query,
            @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(name = "size", defaultValue = "20") @Min(1) @Max(50) int size
    ) { return service.listPublished(locale, category, query, page, size); }

    @GetMapping("/{slug}")
    public ResponseEntity<ExploreResponses.Article> detail(
            @PathVariable("slug") String slug,
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch
    ) {
        ExploreResponses.Article article = service.getPublished(slug, locale);
        String etag = "\"explore-" + article.id() + "-" + article.contentLocale() + "-" + article.revision() + "\"";
        if (etag.equals(ifNoneMatch)) return ResponseEntity.status(304).eTag(etag).cacheControl(CacheControl.noCache()).build();
        return ResponseEntity.ok().eTag(etag).cacheControl(CacheControl.noCache()).body(article);
    }
}
