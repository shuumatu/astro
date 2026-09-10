package com.astro.content.explore;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ExploreArticleRepository extends JpaRepository<ExploreArticle, UUID> {
    Optional<ExploreArticle> findBySlug(String slug);
    boolean existsBySlug(String slug);
    boolean existsBySlugAndIdNot(String slug, UUID id);

    @Query(value = """
            select distinct a from ExploreArticle a
            join a.translations t join t.revisions r
            where a.archivedAt is null and r.status = com.astro.content.explore.ExploreRevisionStatus.PUBLISHED
              and (:category is null or a.category.code = :category)
              and (:query = '' or lower(a.slug) like lower(concat('%', :query, '%'))
                or lower(r.title) like lower(concat('%', :query, '%'))
                or lower(r.summary) like lower(concat('%', :query, '%'))
                or lower(r.tags) like lower(concat('%', :query, '%')))
            order by a.lastPublishedAt desc
            """,
            countQuery = """
            select count(distinct a) from ExploreArticle a
            join a.translations t join t.revisions r
            where a.archivedAt is null and r.status = com.astro.content.explore.ExploreRevisionStatus.PUBLISHED
              and (:category is null or a.category.code = :category)
              and (:query = '' or lower(a.slug) like lower(concat('%', :query, '%'))
                or lower(r.title) like lower(concat('%', :query, '%'))
                or lower(r.summary) like lower(concat('%', :query, '%'))
                or lower(r.tags) like lower(concat('%', :query, '%')))
            """)
    Page<ExploreArticle> findPublished(@Param("category") String category, @Param("query") String query, Pageable pageable);

    @Query(value = """
            select distinct a from ExploreArticle a
            left join a.translations t left join t.revisions r
            where (:category is null or a.category.code = :category)
              and (:query = '' or lower(a.slug) like lower(concat('%', :query, '%'))
                or lower(r.title) like lower(concat('%', :query, '%')))
              and (:status = ''
                or (:status = 'ARCHIVED' and a.archivedAt is not null)
                or (:status = 'DRAFT' and r.status = com.astro.content.explore.ExploreRevisionStatus.DRAFT)
                or (:status = 'PUBLISHED' and r.status = com.astro.content.explore.ExploreRevisionStatus.PUBLISHED))
            order by a.updatedAt desc
            """,
            countQuery = """
            select count(distinct a) from ExploreArticle a
            left join a.translations t left join t.revisions r
            where (:category is null or a.category.code = :category)
              and (:query = '' or lower(a.slug) like lower(concat('%', :query, '%'))
                or lower(r.title) like lower(concat('%', :query, '%')))
              and (:status = ''
                or (:status = 'ARCHIVED' and a.archivedAt is not null)
                or (:status = 'DRAFT' and r.status = com.astro.content.explore.ExploreRevisionStatus.DRAFT)
                or (:status = 'PUBLISHED' and r.status = com.astro.content.explore.ExploreRevisionStatus.PUBLISHED))
            """)
    Page<ExploreArticle> findAdmin(@Param("category") String category, @Param("status") String status,
                                   @Param("query") String query, Pageable pageable);
}
