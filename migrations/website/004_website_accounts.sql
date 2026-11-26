-- Independent website identity. No references to mobile application tables.
CREATE TABLE web_users (
 id CHAR(36) PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 first_name VARCHAR(100) NOT NULL,
 last_name VARCHAR(100) NOT NULL DEFAULT '',
 country_code VARCHAR(5) NOT NULL,
 mobile VARCHAR(15) NOT NULL,
 company_name VARCHAR(200) NOT NULL DEFAULT '',
 password_hash VARCHAR(200) NOT NULL,
 consent_accepted_at DATETIME NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE web_user_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 user_id CHAR(36) NOT NULL,
 expires_at DATETIME NOT NULL,
 INDEX (expires_at),
 FOREIGN KEY (user_id) REFERENCES web_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE web_auth_limits (
 bucket CHAR(64) PRIMARY KEY,
 attempts INT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO web_schema_versions(version) VALUES(4);
