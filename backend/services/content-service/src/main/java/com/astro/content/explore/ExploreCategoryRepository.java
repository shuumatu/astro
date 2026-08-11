package com.astro.content.explore;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExploreCategoryRepository extends JpaRepository<ExploreCategoryEntity, UUID> {
    Optional<ExploreCategoryEntity> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);

    @Query("select c from ExploreCategoryEntity c where (:includeDisabled = true or c.enabled = true) order by c.sortOrder, c.code")
    List<ExploreCategoryEntity> findAllForExplore(@Param("includeDisabled") boolean includeDisabled);
}
