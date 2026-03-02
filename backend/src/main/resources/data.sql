INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES
    (1, 'test@test.com', '$2a$10$7EqJtq98hPqEX7fNZaFWoO5J6WjLJ6U6zsz5WzxubUoil58x2oyS2', 'USER', NOW(), NOW()),
    (2, 'admin@test.com', '$2a$10$7EqJtq98hPqEX7fNZaFWoO5J6WjLJ6U6zsz5WzxubUoil58x2oyS2', 'ADMIN', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO accounts (id, user_id, balance, equity, created_at, updated_at)
VALUES
    (1, 1, 100000.0000, 100000.0000, NOW(), NOW()),
    (2, 2, 100000.0000, 100000.0000, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO instruments (id, symbol, name, type, leverage, last_price, active, created_at, updated_at)
VALUES
    (1, 'AAPL', 'Apple Inc.', 'STOCK', 1, 185.500000, true, NOW(), NOW()),
    (2, 'TSLA', 'Tesla Inc.', 'STOCK', 1, 220.250000, true, NOW(), NOW()),
    (3, 'EURUSD', 'Euro / US Dollar', 'FOREX', 30, 1.082000, true, NOW(), NOW()),
    (4, 'XAUUSD', 'Gold Spot', 'METAL', 20, 2050.000000, true, NOW(), NOW()),
    (5, 'SPY', 'SPDR S&P 500 ETF', 'ETF', 1, 500.750000, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO market_prices (instrument_id, symbol, price, ts)
VALUES
    (1, 'AAPL', 185.500000, NOW()),
    (2, 'TSLA', 220.250000, NOW()),
    (3, 'EURUSD', 1.082000, NOW()),
    (4, 'XAUUSD', 2050.000000, NOW()),
    (5, 'SPY', 500.750000, NOW());
