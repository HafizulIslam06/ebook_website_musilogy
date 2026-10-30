CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(190) NOT NULL,
  short_description VARCHAR(500) NOT NULL,
  details           TEXT NULL,
  cover_url         VARCHAR(255) NULL,
  regular_price     DECIMAL(10,2) NOT NULL,
  discount_price    DECIMAL(10,2) NOT NULL,
  tags              JSON NULL,
  preview_text      TEXT NULL,
  preview_url       VARCHAR(2048) NULL,
  delivery_text     TEXT NULL,
  faqs              JSON NULL,
  pdf_url           VARCHAR(2048) NULL,
  pdf_file          VARCHAR(100) NULL,
  video_links       JSON NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number      VARCHAR(32) NOT NULL UNIQUE,
  product_id        INT UNSIGNED NOT NULL,
  customer_name     VARCHAR(120) NOT NULL,
  customer_phone    VARCHAR(20) NOT NULL,
  customer_email    VARCHAR(190) NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  status            ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  access_token_hash CHAR(64) NOT NULL UNIQUE,
  paid_at           TIMESTAMP NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_status (status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_product FOREIGN KEY (product_id) REFERENCES products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- invoice_id is UNIQUE so one gateway payment can never be applied twice.
CREATE TABLE IF NOT EXISTS payments (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED NOT NULL,
  invoice_id     VARCHAR(64) NOT NULL UNIQUE,
  transaction_id VARCHAR(100) NULL,
  payment_method VARCHAR(50) NULL,
  sender_number  VARCHAR(30) NULL,
  amount         DECIMAL(10,2) NULL,
  fee            DECIMAL(10,2) NULL,
  charged_amount DECIMAL(10,2) NULL,
  status         ENUM('pending','completed','failed') NOT NULL,
  note           VARCHAR(190) NULL,
  gateway_response JSON NULL,
  verified_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payments_order (order_id),
  KEY idx_payments_transaction (transaction_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row: what the site footer and the contact and policy pages show.
CREATE TABLE IF NOT EXISTS site_settings (
  id              TINYINT UNSIGNED PRIMARY KEY,
  tagline         VARCHAR(190) NOT NULL,
  whatsapp        VARCHAR(20) NULL,
  support_email   VARCHAR(190) NULL,
  payment_methods JSON NULL,
  contact_text    TEXT NULL,
  privacy_policy  TEXT NULL,
  terms           TEXT NULL,
  refund_policy   TEXT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings (id, tagline, payment_methods)
VALUES (1, 'Learn guitar, one chord at a time.', '["bKash", "Nagad", "Rocket"]');

INSERT IGNORE INTO products
  (id, title, short_description, details, cover_url, regular_price, discount_price, tags, preview_text, delivery_text, faqs, video_links)
VALUES (
  1,
  'Guitar From Zero',
  'Learn your first chords, strumming patterns and full songs with a step-by-step eBook and 23 video lessons.',
  'Everything you need to go from never holding a guitar to playing real songs.\n\nEach lesson builds on the last, with tabs you can follow along with at your own pace. No music theory background required.',
  '/cover-placeholder.svg',
  1500.00,
  499.00,
  '["23 Video Lessons", "eBook (PDF)", "Guitar Tabs", "Beginner Friendly"]',
  '1. Holding the guitar and tuning it\n2. Your first open chords\n3. Strumming patterns that sound right\n4. Changing chords without stopping\n5. Reading guitar tabs\n6. Playing your first complete songs',
  '1. Pay with bKash, Nagad, or Rocket on the secure checkout page.\n2. Your private order page opens with the PDF download and all video lessons.\n3. Send that link to your Gmail or WhatsApp in one tap, so you can come back to it any time.',
  '[{"question": "Do I need any experience?", "answer": "No. The course starts from how to hold the guitar."}, {"question": "How do I get access after paying?", "answer": "As soon as your payment is confirmed, your order page shows the PDF download and all video lessons. You can send that private link to your Gmail or WhatsApp in one tap, so you can come back to it any time."}, {"question": "Is this a subscription?", "answer": "No. You pay once."}, {"question": "Which payment methods can I use?", "answer": "You can pay with bKash, Rocket or Nagad on our secure checkout page."}]',
  '[]'
);
