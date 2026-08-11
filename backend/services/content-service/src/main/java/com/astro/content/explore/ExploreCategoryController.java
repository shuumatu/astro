package com.astro.content.explore;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/content/explore/categories")
public class ExploreCategoryController {
    private final ExploreService service;

    public ExploreCategoryController(ExploreService service) { this.service = service; }

    @GetMapping
    public List<ExploreResponses.Category> list(
            @RequestParam(name = "locale", defaultValue = "zh-CN") String locale) {
        return service.listCategories(locale, true);
    }
}
