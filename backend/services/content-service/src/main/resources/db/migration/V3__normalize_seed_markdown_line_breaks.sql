UPDATE content_catalog_translation
SET body_markdown = REPLACE(body_markdown, '\n', '
')
WHERE body_markdown LIKE '%\n%';
