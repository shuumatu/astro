package com.astro.content.explore;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/content/admin/explore/articles")
@PreAuthorize("hasRole('CONTENT_ADMIN')")
public class ExploreAdminController {
    private final ExploreService service;
    public ExploreAdminController(ExploreService service) { this.service = service; }

    @GetMapping
    public ExploreResponses.AdminPage list(
            @RequestParam(name = "category", required = false) String category,
            @RequestParam(name = "status", defaultValue = "") String status,
            @RequestParam(name = "query", defaultValue = "") @Size(max = 120) String query,
            @RequestParam(name = "page", defaultValue = "0") @Min(0) int page,
            @RequestParam(name = "size", defaultValue = "50") @Min(1) @Max(100) int size
    ) { return service.listAdmin(category, status, query, page, size); }

    @PostMapping
    public ExploreResponses.AdminSummary create(@Valid @RequestBody ExploreRequests.CreateArticle request) {
        return service.create(request);
    }

    @PutMapping("/{articleId}")
    public ExploreResponses.AdminSummary updateMetadata(@PathVariable("articleId") UUID articleId,
                                                        @Valid @RequestBody ExploreRequests.UpdateMetadata request) {
        return service.updateMetadata(articleId, request);
    }

    @PutMapping("/{articleId}/translations/{locale}")
    public ExploreResponses.Article saveDraft(@PathVariable("articleId") UUID articleId,
                                              @PathVariable("locale") String locale,
                                              @Valid @RequestBody ExploreRequests.SaveDraft request) {
        return service.saveDraft(articleId, locale, request);
    }

    @GetMapping("/{articleId}/translations/{locale}/preview")
    public ExploreResponses.Article preview(@PathVariable("articleId") UUID articleId,
                                            @PathVariable("locale") String locale) {
        return service.preview(articleId, locale);
    }

    @PostMapping("/{articleId}/translations/{locale}/publish")
    public ExploreResponses.Article publish(@PathVariable("articleId") UUID articleId,
                                            @PathVariable("locale") String locale) {
        return service.publish(articleId, locale);
    }

    @PostMapping("/{articleId}/translations/{locale}/unpublish")
    public void unpublish(@PathVariable("articleId") UUID articleId,
                          @PathVariable("locale") String locale) { service.unpublish(articleId, locale); }

    @GetMapping("/{articleId}/translations/{locale}/revisions")
    public List<ExploreResponses.Revision> revisions(@PathVariable("articleId") UUID articleId,
                                                     @PathVariable("locale") String locale) {
        return service.revisions(articleId, locale);
    }

    @PostMapping("/{articleId}/translations/{locale}/revisions/{revisionId}/restore")
    public ExploreResponses.Article restoreRevision(@PathVariable("articleId") UUID articleId,
                                                    @PathVariable("locale") String locale,
                                                    @PathVariable("revisionId") UUID revisionId) {
        return service.restoreRevision(articleId, locale, revisionId);
    }

    @GetMapping(value = "/{articleId}/translations/{locale}/markdown", produces = "text/markdown")
    public ResponseEntity<String> exportMarkdown(@PathVariable("articleId") UUID articleId,
                                                  @PathVariable("locale") String locale) {
        String filename = service.markdownFilename(articleId, locale);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/markdown;charset=UTF-8"))
                .body(service.exportMarkdown(articleId, locale));
    }

    @PostMapping(value = "/{articleId}/translations/{locale}/markdown", consumes = "text/markdown")
    public ExploreResponses.Article importMarkdown(@PathVariable("articleId") UUID articleId,
                                                    @PathVariable("locale") String locale,
                                                    @RequestBody @Size(max = 150000) String document) {
        return service.importMarkdown(articleId, locale, document);
    }

    @PostMapping("/{articleId}/archive")
    public ExploreResponses.AdminSummary archive(@PathVariable("articleId") UUID articleId) {
        return service.setArchived(articleId, true);
    }

    @PostMapping("/{articleId}/restore")
    public ExploreResponses.AdminSummary restore(@PathVariable("articleId") UUID articleId) {
        return service.setArchived(articleId, false);
    }
}
