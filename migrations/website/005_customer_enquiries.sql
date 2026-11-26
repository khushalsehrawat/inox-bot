-- Website-only customer history. Existing guest enquiries remain unclaimed.
ALTER TABLE web_enquiries
 ADD COLUMN customer_id CHAR(36) NULL,
 ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'New',
 ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 ADD INDEX web_enquiries_customer (customer_id, created_at, id),
 ADD CONSTRAINT web_enquiries_customer_fk FOREIGN KEY (customer_id) REFERENCES web_users(id) ON DELETE RESTRICT;
CREATE TABLE web_customer_activity (
 id CHAR(36) PRIMARY KEY,
 customer_id CHAR(36) NOT NULL,
 event VARCHAR(32) NOT NULL,
 details JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX web_customer_activity_customer (customer_id, created_at, id),
 FOREIGN KEY (customer_id) REFERENCES web_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO web_schema_versions(version) VALUES(5);
