CREATE TABLE explore_category (
    id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE explore_category_translation (
    id UUID PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES explore_category(id) ON DELETE CASCADE,
    locale VARCHAR(35) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(500),
    CONSTRAINT uq_explore_category_translation UNIQUE (category_id, locale)
);

INSERT INTO explore_category (id, code, enabled, sort_order, created_at, updated_at) VALUES
 ('10000000-0000-0000-0000-000000000001', 'UNIVERSE', TRUE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('10000000-0000-0000-0000-000000000002', 'PHENOMENA', TRUE, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('10000000-0000-0000-0000-000000000003', 'OBSERVATION', TRUE, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('10000000-0000-0000-0000-000000000004', 'FUNDAMENTALS', TRUE, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
 ('10000000-0000-0000-0000-000000000005', 'GUIDES', TRUE, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO explore_category_translation (id, category_id, locale, name, description) VALUES
 ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'zh-CN', '天体与宇宙', '恒星、星系、黑洞与宇宙结构'),
 ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'en', 'Objects & universe', 'Stars, galaxies, black holes, and cosmic structure'),
 ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'zh-CN', '天象与事件', '月相、流星、日食与其他天空现象'),
 ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'en', 'Sky phenomena', 'Moon phases, meteors, eclipses, and other events'),
 ('11000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'zh-CN', '观测与工具', '望远镜、观测方法与数据工具'),
 ('11000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'en', 'Observation & tools', 'Telescopes, observing methods, and data tools'),
 ('11000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004', 'zh-CN', '基础概念', '理解天文学所需的基础知识'),
 ('11000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 'en', 'Fundamentals', 'Foundations for learning astronomy'),
 ('11000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000005', 'zh-CN', '观星指南', '适合实际观测的步骤与建议'),
 ('11000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', 'en', 'Observation guides', 'Practical steps and advice for observing');

ALTER TABLE explore_article ADD COLUMN category_id UUID;
UPDATE explore_article SET category_id = CASE category
    WHEN 'UNIVERSE' THEN CAST('10000000-0000-0000-0000-000000000001' AS UUID)
    WHEN 'PHENOMENA' THEN CAST('10000000-0000-0000-0000-000000000002' AS UUID)
    WHEN 'OBSERVATION' THEN CAST('10000000-0000-0000-0000-000000000003' AS UUID)
    WHEN 'FUNDAMENTALS' THEN CAST('10000000-0000-0000-0000-000000000004' AS UUID)
    WHEN 'GUIDES' THEN CAST('10000000-0000-0000-0000-000000000005' AS UUID)
END;
ALTER TABLE explore_article ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE explore_article ADD CONSTRAINT fk_explore_article_category FOREIGN KEY (category_id) REFERENCES explore_category(id);
ALTER TABLE explore_article DROP CONSTRAINT ck_explore_category;
DROP INDEX IF EXISTS idx_explore_article_category;
ALTER TABLE explore_article DROP COLUMN category;
CREATE INDEX idx_explore_category_enabled ON explore_category(enabled, sort_order);
CREATE INDEX idx_explore_category_translation_locale ON explore_category_translation(locale, category_id);
