DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS wallet_transactions;
DROP TABLE IF EXISTS payment_requests;
DROP TABLE IF EXISTS market_prices;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    balance NUMERIC(19,4) NOT NULL,
    equity NUMERIC(19,4) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE instruments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    leverage INTEGER NOT NULL,
    last_price NUMERIC(19,6) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    instrument_id BIGINT NOT NULL,
    side VARCHAR(10) NOT NULL,
    type VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    limit_price NUMERIC(19,6),
    take_profit NUMERIC(19,6),
    stop_loss NUMERIC(19,6),
    filled_price NUMERIC(19,6),
    margin_required NUMERIC(19,6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_orders_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_orders_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id)
) ENGINE=InnoDB;

CREATE TABLE positions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    instrument_id BIGINT NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    average_price NUMERIC(19,6) NOT NULL,
    realized_pnl NUMERIC(19,6) NOT NULL,
    take_profit NUMERIC(19,6),
    stop_loss NUMERIC(19,6),
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_position_account_instrument UNIQUE (account_id, instrument_id),
    CONSTRAINT fk_positions_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_positions_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id)
) ENGINE=InnoDB;

CREATE TABLE trades (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    instrument_id BIGINT NOT NULL,
    side VARCHAR(10) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    price NUMERIC(19,6) NOT NULL,
    realized_pnl NUMERIC(19,6) NOT NULL,
    executed_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_trades_order FOREIGN KEY (order_id) REFERENCES orders(id),
    CONSTRAINT fk_trades_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_trades_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id)
) ENGINE=InnoDB;

CREATE TABLE market_prices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    instrument_id BIGINT NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    price NUMERIC(19,6) NOT NULL,
    ts DATETIME(6) NOT NULL,
    CONSTRAINT fk_market_prices_instrument FOREIGN KEY (instrument_id) REFERENCES instruments(id)
) ENGINE=InnoDB;

CREATE TABLE payment_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    correlation_id VARCHAR(120) NOT NULL,
    code_masked VARCHAR(32),
    amount NUMERIC(19,4) NOT NULL,
    status VARCHAR(24) NOT NULL,
    store_name VARCHAR(120) NOT NULL,
    provider_request_id VARCHAR(120),
    source VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    finalized_at DATETIME(6),
    CONSTRAINT uk_payment_requests_correlation UNIQUE (correlation_id),
    CONSTRAINT fk_payment_requests_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;

CREATE TABLE wallet_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    account_id BIGINT NOT NULL,
    type VARCHAR(24) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    balance_before NUMERIC(19,4) NOT NULL,
    balance_after NUMERIC(19,4) NOT NULL,
    source VARCHAR(32) NOT NULL,
    correlation_id VARCHAR(120),
    note VARCHAR(255),
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT fk_wallet_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB;

CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_market_prices_symbol_ts ON market_prices(symbol, ts);
CREATE INDEX idx_payment_requests_account_created ON payment_requests(account_id, created_at);
CREATE INDEX idx_wallet_transactions_account_created ON wallet_transactions(account_id, created_at);
