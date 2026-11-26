-- Actual website upload bytes, separate from mobile tables and deploy filesystems.
CREATE TABLE web_media_content (url VARCHAR(200) PRIMARY KEY, content LONGBLOB NOT NULL, FOREIGN KEY(url) REFERENCES web_media(url) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO web_schema_versions(version) VALUES(3);
