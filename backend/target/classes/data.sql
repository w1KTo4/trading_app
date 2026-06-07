INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
VALUES
    (1, 'test@test.com', '$2a$10$QOQThAHip3KIdsSev3tT8ugVym/pQCC9D/01SRiOOako8Xf2TCDc2', 'USER', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (2, 'admin@test.com', '$2a$10$QOQThAHip3KIdsSev3tT8ugVym/pQCC9D/01SRiOOako8Xf2TCDc2', 'ADMIN', UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO accounts (id, user_id, balance, equity, created_at, updated_at)
VALUES
    (1, 1, 0.0000, 0.0000, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (2, 2, 0.0000, 0.0000, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO instruments (id, symbol, name, type, leverage, last_price, active, created_at, updated_at)
VALUES
    (1, 'BTCUSD', 'Bitcoin / US Dollar', 'CRYPTO', 2, 94000.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (2, 'ETHUSD', 'Ethereum / US Dollar', 'CRYPTO', 2, 4600.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (3, 'BNBUSD', 'BNB / US Dollar', 'CRYPTO', 2, 690.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (4, 'SOLUSD', 'Solana / US Dollar', 'CRYPTO', 2, 210.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (5, 'XRPUSD', 'XRP / US Dollar', 'CRYPTO', 2, 1.450000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (6, 'DOGEUSD', 'Dogecoin / US Dollar', 'CRYPTO', 2, 0.280000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (7, 'ADAUSD', 'Cardano / US Dollar', 'CRYPTO', 2, 0.950000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (8, 'TRXUSD', 'TRON / US Dollar', 'CRYPTO', 2, 0.140000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (9, 'AVAXUSD', 'Avalanche / US Dollar', 'CRYPTO', 2, 54.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (10, 'LINKUSD', 'Chainlink / US Dollar', 'CRYPTO', 2, 22.000000, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

INSERT INTO market_prices (instrument_id, symbol, price, ts)
VALUES
    (1, 'BTCUSD', 94000.000000, UTC_TIMESTAMP(6)),
    (2, 'ETHUSD', 4600.000000, UTC_TIMESTAMP(6)),
    (3, 'BNBUSD', 690.000000, UTC_TIMESTAMP(6)),
    (4, 'SOLUSD', 210.000000, UTC_TIMESTAMP(6)),
    (5, 'XRPUSD', 1.450000, UTC_TIMESTAMP(6)),
    (6, 'DOGEUSD', 0.280000, UTC_TIMESTAMP(6)),
    (7, 'ADAUSD', 0.950000, UTC_TIMESTAMP(6)),
    (8, 'TRXUSD', 0.140000, UTC_TIMESTAMP(6)),
    (9, 'AVAXUSD', 54.000000, UTC_TIMESTAMP(6)),
    (10, 'LINKUSD', 22.000000, UTC_TIMESTAMP(6));

