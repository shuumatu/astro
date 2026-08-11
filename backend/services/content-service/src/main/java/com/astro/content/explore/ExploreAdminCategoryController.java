package com.astro.content.explore;

import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/content/admin/explore/categories")
@PreAuthorize("hasRole('CONTENT_ADMIN')")
public class ExploreAdminCategoryController {
    private final ExploreService service;

    public ExploreAdminCategoryController(ExploreService service) { this.service = service; }

    @GetMapping
    public List<ExploreResponses.AdminCategory> list() { return service.listAdminCategories(); }

    @PostMapping
    public ExploreResponses.AdminCategory create(@Valid @RequestBody ExploreRequests.CreateCategory request) {
        return service.createCategory(request);
    }

    @PutMapping("/{categoryId}")
    public ExploreResponses.AdminCategory update(@PathVariable("categoryId") UUID categoryId,
                                                  @Valid @RequestBody ExploreRequests.UpdateCategory request) {
        return service.updateCategory(categoryId, request);
    }
}
