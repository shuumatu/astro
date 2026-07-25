CREATE TABLE content_catalog_entry (
    id UUID PRIMARY KEY,
    object_type VARCHAR(32) NOT NULL,
    object_key VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_content_catalog_object UNIQUE (object_type, object_key),
    CONSTRAINT ck_content_catalog_object_type CHECK (object_type IN ('STAR', 'SOLAR_SYSTEM_BODY', 'CULTURE_FIGURE'))
);

CREATE TABLE content_catalog_translation (
    id UUID PRIMARY KEY,
    entry_id UUID NOT NULL REFERENCES content_catalog_entry(id) ON DELETE CASCADE,
    locale VARCHAR(35) NOT NULL,
    status VARCHAR(16) NOT NULL,
    title VARCHAR(160) NOT NULL,
    summary VARCHAR(600) NOT NULL,
    body_markdown TEXT NOT NULL,
    knowledge_points TEXT NOT NULL DEFAULT '[]',
    image_caption VARCHAR(500),
    revision INTEGER NOT NULL DEFAULT 1,
    published_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_content_translation_locale UNIQUE (entry_id, locale),
    CONSTRAINT ck_content_translation_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_content_translation_revision CHECK (revision > 0)
);

CREATE TABLE content_catalog_source (
    id UUID PRIMARY KEY,
    translation_id UUID NOT NULL REFERENCES content_catalog_translation(id) ON DELETE CASCADE,
    title VARCHAR(240) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    author VARCHAR(240),
    license VARCHAR(160),
    attribution VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE content_catalog_media_reference (
    id UUID PRIMARY KEY,
    translation_id UUID NOT NULL REFERENCES content_catalog_translation(id) ON DELETE CASCADE,
    media_id VARCHAR(200) NOT NULL,
    alt_text VARCHAR(500) NOT NULL,
    caption VARCHAR(500),
    author VARCHAR(240),
    license VARCHAR(160) NOT NULL,
    attribution VARCHAR(500) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_content_translation_status_locale
    ON content_catalog_translation(status, locale);
CREATE INDEX idx_content_source_translation
    ON content_catalog_source(translation_id, sort_order);
CREATE INDEX idx_content_media_translation
    ON content_catalog_media_reference(translation_id, sort_order);
