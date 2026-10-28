-- =====================================================================
-- Budget App database schema
-- Commerce Bank / UMKC Capstone - Fall 2026
-- MySQL 8.0+ | InnoDB | utf8mb4
--
-- DEVELOPMENT ONLY: drops and recreates every table. All data is lost.
-- Run the whole file in MySQL Workbench as root (admin), not as budget_app_user.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS db_budget_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;               
USE db_budget_app;

-- Drop in reverse dependency order (children before parents)
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS budget_allocations;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS payment_methods;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT          NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- categories (name is the label, e.g. Groceries, Bills)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id   INT          NOT NULL AUTO_INCREMENT,
  kind VARCHAR(10)  NOT NULL,
  name VARCHAR(100) NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  CONSTRAINT chk_categories_kind   CHECK (kind IN ('income', 'need', 'want'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------
CREATE TABLE budgets (
  id                    INT               NOT NULL AUTO_INCREMENT,
  user_id               INT               NOT NULL,
  expected_amount       DECIMAL(12,2)     NOT NULL,
  budget_month          DATE              NOT NULL,
  needs_pct             TINYINT UNSIGNED  NOT NULL,
  wants_pct             TINYINT UNSIGNED  NOT NULL,
  savings_pct           TINYINT UNSIGNED  NOT NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_budgets_user_month (user_id, budget_month),  -- each user, gets only one budget per month
  CONSTRAINT chk_budgets_month CHECK (DAY(budget_month) = 1), -- ensures budget_month stores only first day of months 
  CONSTRAINT chk_budgets_amount CHECK (expected_amount >= 0),
  CONSTRAINT chk_budgets_split CHECK (needs_pct + wants_pct + savings_pct = 100),
  CONSTRAINT fk_budgets_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Allocation of budget defined by User, one row per expense category(Rent, Bills, etc) per monthly budget ($0 allowed)
-- ---------------------------------------------------------------------
CREATE TABLE budget_allocations (
  id                    INT           NOT NULL AUTO_INCREMENT,
  budget_id             INT           NOT NULL,
  category_id           INT           NOT NULL,
  amount                DECIMAL(12,2) NOT NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_budget_allocations_budget_category (budget_id, category_id),
  CONSTRAINT chk_budget_allocations_amount CHECK (amount >= 0), 
  CONSTRAINT fk_budget_allocations_budget
    FOREIGN KEY (budget_id) REFERENCES budgets (id) ON DELETE CASCADE,
  CONSTRAINT fk_budget_allocations_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
  
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- transactions
-- category_id = what it was for; transaction_type = income or expense
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
  id                INT           NOT NULL AUTO_INCREMENT,
  user_id           INT           NOT NULL,
  category_id       INT           NULL,        -- tracks the transaction category(groceries, salary, refund, bills, etc)
  amount            DECIMAL(12,2) NOT NULL,
  description       VARCHAR(255)  NULL,   -- notes for transation, can be empty
  transaction_type  VARCHAR(10)   NOT NULL,      -- tracks if income or expense
  transaction_date  DATE          NOT NULL DEFAULT (CURRENT_DATE),
  created_at        TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT chk_transactions_amount CHECK (amount > 0),  -- no negative amount, expense transaction type will determine decicsion to remove from budget allocation
  CONSTRAINT chk_transactions_type   CHECK (transaction_type IN ('income', 'expense')),
  CONSTRAINT fk_transactions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_transactions_category
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
  KEY idx_transactions_user_date (user_id, transaction_date),
  KEY idx_transactions_category (category_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- sessions
-- Stores a SHA-256 hash of the session token, never the token itself.
-- ---------------------------------------------------------------------
CREATE TABLE sessions (
  id         INT      NOT NULL AUTO_INCREMENT,
  user_id    INT      NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_revoked BOOLEAN  NOT NULL DEFAULT FALSE,

  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_token_hash (token_hash),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expires (expires_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Seed data: category labels
-- ---------------------------------------------------------------------
INSERT INTO categories (name, kind) VALUES
('Groceries', 'need'), ('Bills', 'need'), ('Rent', 'need'),
('Utilities', 'need'), ('Transportation', 'need'), ('Healthcare', 'need'),
('Dining Out', 'want'), ('Entertainment', 'want'), ('Shopping', 'want'),
('Salary', 'income'), ('Freelance', 'income'), ('Gifts', 'income'), ('Refund', 'income'), ('Other Income', 'income');