ALTER TABLE content_catalog_entry
    DROP CONSTRAINT ck_content_catalog_object_type;

ALTER TABLE content_catalog_entry
    ADD CONSTRAINT ck_content_catalog_object_type
        CHECK (object_type IN ('STAR', 'SOLAR_SYSTEM_BODY', 'CULTURE_FIGURE', 'FEATURED_PATTERN'));
