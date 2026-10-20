
-- =====================================================================
-- Budget Tracker Database Schema  (v2 - updated class diagram)
-- Commerce Bank / UMKC Capstone - Fall 2026
-- Target: MySQL 8.0.16+ | Engine: InnoDB | Charset: utf8mb4
--
-- Full rebuild: DROPS and recreates every table. Use
-- budget_tracker_migration.sql instead if you need to keep existing data.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS db_budget_app;
USE db_budget_app;

CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    
);
-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  username      VARCHAR(50)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- categories (id + type only; type is the label, e.g. Groceries, Bills)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id   CHAR(36)     NOT NULL DEFAULT (UUID()),
  type VARCHAR(100) NOT NULL,
  PRIMARY KEY (id)
  -- , UNIQUE KEY uq_categories_type (type)   -- optional: no duplicate labels
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- payment_methods (fabricated card data only)
-- is_default = TRUE marks the user's main payment method; all others
-- for that user should be FALSE (enforce in the application layer).
-- ---------------------------------------------------------------------
CREATE TABLE payment_methods (
  id           CHAR(36)    NOT NULL DEFAULT (UUID()),
  user_id      CHAR(36)    NOT NULL,
  nickname     VARCHAR(50) NOT NULL,
  card_last4   CHAR(4)     NOT NULL,
  card_network ENUM('VISA', 'MASTER', 'AMEX', 'DISCOVER', 'OTHER') NULL,
  expire_date  DATE        NOT NULL,
  is_default   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_payment_methods_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_payment_methods_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------
CREATE TABLE budgets (
  id           CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id      CHAR(36)      NOT NULL,
  category_id  CHAR(36)      NOT NULL,
  amount_limit DECIMAL(12,2) NOT NULL,
  period_type  VARCHAR(10)   NOT NULL,
  start_date   DATE          NOT NULL,
  end_date     DATE          NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_budgets_amount CHECK (amount_limit >= 0),
  CONSTRAINT chk_budgets_period CHECK (period_type IN ('weekly', 'monthly')),
  CONSTRAINT chk_budgets_dates  CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT fk_budgets_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_budgets_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_budgets_user_category (user_id, category_id),
  KEY idx_budgets_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- transactions (unchanged)
-- category_id says WHAT the transaction was for;
-- transaction_type says whether it is income or expense.
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
  id                CHAR(36)      NOT NULL DEFAULT (UUID()),
  user_id           CHAR(36)      NOT NULL,
  category_id       CHAR(36)      NULL,
  payment_method_id CHAR(36)      NULL,
  amount            DECIMAL(12,2) NOT NULL,
  transaction_type  VARCHAR(10)   NOT NULL,
  transaction_date  DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_transactions_amount CHECK (amount > 0),
  CONSTRAINT chk_transactions_type   CHECK (transaction_type IN ('income', 'expense')),
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_transactions_payment_method
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_transactions_user_date (user_id, transaction_date),
  KEY idx_transactions_category (category_id),
  KEY idx_transactions_payment_method (payment_method_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()),
  user_id       CHAR(36)     NOT NULL,
  session_token VARCHAR(255) NOT NULL,
  expires_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token (session_token),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Seed data: category labels
-- ---------------------------------------------------------------------
INSERT INTO categories (type) VALUES
  ('Groceries'),
  ('Bills'),
  ('Dining Out'),
  ('Rent'),
  ('Utilities'),
  ('Transportation'),
  ('Entertainment'),
  ('Healthcare'),
  ('Shopping'),
  ('Salary'),
  ('Freelance'),
  ('Gifts'),
  ('Other Income') 
  ;

