ALTER TABLE content_catalog_media_reference
    ALTER COLUMN license DROP NOT NULL;

ALTER TABLE content_catalog_media_reference
    ALTER COLUMN attribution DROP NOT NULL;
