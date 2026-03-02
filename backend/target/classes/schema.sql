DROP TABLE IF EXISTS trades;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS market_prices;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS instruments;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    balance NUMERIC(19,4) NOT NULL,
    equity NUMERIC(19,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE instruments (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL,
    leverage INTEGER NOT NULL,
    last_price NUMERIC(19,6) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    side VARCHAR(10) NOT NULL,
    type VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    limit_price NUMERIC(19,6),
    take_profit NUMERIC(19,6),
    stop_loss NUMERIC(19,6),
    filled_price NUMERIC(19,6),
    margin_required NUMERIC(19,6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    quantity NUMERIC(19,6) NOT NULL,
    average_price NUMERIC(19,6) NOT NULL,
    realized_pnl NUMERIC(19,6) NOT NULL,
    take_profit NUMERIC(19,6),
    stop_loss NUMERIC(19,6),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_position_account_instrument UNIQUE (account_id, instrument_id)
);

CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    side VARCHAR(10) NOT NULL,
    quantity NUMERIC(19,6) NOT NULL,
    price NUMERIC(19,6) NOT NULL,
    realized_pnl NUMERIC(19,6) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE market_prices (
    id BIGSERIAL PRIMARY KEY,
    instrument_id BIGINT NOT NULL REFERENCES instruments(id),
    symbol VARCHAR(32) NOT NULL,
    price NUMERIC(19,6) NOT NULL,
    ts TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_orders_account_id ON orders(account_id);
CREATE INDEX idx_market_prices_symbol_ts ON market_prices(symbol, ts DESC);
