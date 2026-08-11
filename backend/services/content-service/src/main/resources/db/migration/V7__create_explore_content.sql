CREATE TABLE explore_article (
    id UUID PRIMARY KEY,
    slug VARCHAR(120) NOT NULL UNIQUE,
    category VARCHAR(24) NOT NULL,
    difficulty VARCHAR(24) NOT NULL,
    archived_at TIMESTAMP WITH TIME ZONE,
    last_published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT ck_explore_category CHECK (category IN ('UNIVERSE', 'PHENOMENA', 'OBSERVATION', 'FUNDAMENTALS', 'GUIDES')),
    CONSTRAINT ck_explore_difficulty CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'))
);

CREATE TABLE explore_translation (
    id UUID PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES explore_article(id) ON DELETE CASCADE,
    locale VARCHAR(35) NOT NULL,
    CONSTRAINT uq_explore_translation_locale UNIQUE (article_id, locale)
);

CREATE TABLE explore_revision (
    id UUID PRIMARY KEY,
    translation_id UUID NOT NULL REFERENCES explore_translation(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL,
    title VARCHAR(160) NOT NULL,
    summary VARCHAR(600) NOT NULL,
    body_markdown TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    estimated_minutes INTEGER NOT NULL DEFAULT 5,
    cover_image_url VARCHAR(2048),
    cover_image_alt VARCHAR(500),
    cover_image_caption VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT uq_explore_revision_number UNIQUE (translation_id, revision_number),
    CONSTRAINT ck_explore_revision_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
    CONSTRAINT ck_explore_revision_number CHECK (revision_number > 0),
    CONSTRAINT ck_explore_estimated_minutes CHECK (estimated_minutes BETWEEN 1 AND 60)
);

CREATE TABLE explore_source (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES explore_revision(id) ON DELETE CASCADE,
    title VARCHAR(240) NOT NULL,
    url VARCHAR(2048) NOT NULL,
    author VARCHAR(240),
    license VARCHAR(160),
    attribution VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE explore_image_credit (
    id UUID PRIMARY KEY,
    revision_id UUID NOT NULL REFERENCES explore_revision(id) ON DELETE CASCADE,
    image_url VARCHAR(2048) NOT NULL,
    source_page_url VARCHAR(2048) NOT NULL,
    author VARCHAR(240),
    license VARCHAR(160),
    attribution VARCHAR(500),
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT uq_explore_credit_image UNIQUE (revision_id, image_url)
);

CREATE INDEX idx_explore_article_category ON explore_article(category, updated_at);
CREATE INDEX idx_explore_revision_status ON explore_revision(status, published_at);
CREATE INDEX idx_explore_translation_article ON explore_translation(article_id, locale);
CREATE INDEX idx_explore_source_revision ON explore_source(revision_id, sort_order);
CREATE INDEX idx_explore_credit_revision ON explore_image_credit(revision_id, sort_order);
