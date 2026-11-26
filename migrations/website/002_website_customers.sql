-- Website sign-in tracking only. Authentication remains with the existing INOX API.
-- Deliberately no foreign keys to, or writes against, mobile application tables.
CREATE TABLE web_customers (id VARCHAR(100) PRIMARY KEY, email VARCHAR(254) NOT NULL, profile JSON NOT NULL, first_login TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, login_count INT UNSIGNED NOT NULL DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO web_schema_versions(version) VALUES(2);
