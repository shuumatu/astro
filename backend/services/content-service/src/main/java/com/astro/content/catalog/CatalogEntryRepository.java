package com.astro.content.catalog;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CatalogEntryRepository extends JpaRepository<CatalogEntry, UUID> {
    Optional<CatalogEntry> findByObjectTypeAndObjectKey(CatalogObjectType objectType, String objectKey);

    boolean existsByObjectTypeAndObjectKey(CatalogObjectType objectType, String objectKey);

    @Query(value = """
            select e from CatalogEntry e
            where (:objectType is null or e.objectType = :objectType)
              and exists (
                select t.id from CatalogTranslation t
                where t.entry = e and t.status = com.astro.content.catalog.PublicationStatus.PUBLISHED
                  and (:query = '' or lower(t.title) like lower(concat('%', :query, '%'))
                    or lower(t.summary) like lower(concat('%', :query, '%'))
                    or lower(e.objectKey) like lower(concat('%', :query, '%')))
              )
            order by e.updatedAt desc
            """,
            countQuery = """
            select count(e) from CatalogEntry e
            where (:objectType is null or e.objectType = :objectType)
              and exists (
                select t.id from CatalogTranslation t
                where t.entry = e and t.status = com.astro.content.catalog.PublicationStatus.PUBLISHED
                  and (:query = '' or lower(t.title) like lower(concat('%', :query, '%'))
                    or lower(t.summary) like lower(concat('%', :query, '%'))
                    or lower(e.objectKey) like lower(concat('%', :query, '%')))
              )
            """)
    Page<CatalogEntry> findPublished(
            @Param("objectType") CatalogObjectType objectType,
            @Param("query") String query,
            Pageable pageable
    );
}
