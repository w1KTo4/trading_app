package com.example.trading.marketdata.adapter;

import com.example.trading.config.MarketDataProperties;
import com.example.trading.dto.CandleDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.example.trading.marketdata.strategy.MarketDataProvider;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class BinanceMarketDataAdapter implements MarketDataProvider {

    private static final Logger log = LoggerFactory.getLogger(BinanceMarketDataAdapter.class);
    private static final long EXCHANGE_INFO_REFRESH_SECONDS = 15 * 60;

    private final MarketDataProperties marketDataProperties;
    private final RestClient restClient;
    private final Set<String> tradableProviderSymbols = ConcurrentHashMap.newKeySet();
    private final Set<String> invalidProviderSymbols = ConcurrentHashMap.newKeySet();
    private volatile Instant lastExchangeInfoRefresh = null;
    private volatile boolean exchangeInfoLoaded = false;

    public BinanceMarketDataAdapter(MarketDataProperties marketDataProperties) {
        this.marketDataProperties = marketDataProperties;
        this.restClient = RestClient.builder()
                .baseUrl(marketDataProperties.getBaseUrl())
                .build();
    }

    @Override
    public boolean isEnabled() {
        return marketDataProperties.isEnabled();
    }

    @Override
    public String providerName() {
        return marketDataProperties.getProvider().toUpperCase(Locale.ROOT);
    }

    @Override
    public boolean supportsInstrument(Instrument instrument) {
        if (!isEnabled() || instrument == null || instrument.getType() != InstrumentType.CRYPTO) {
            return false;
        }
        Optional<String> providerSymbol = toProviderSymbol(instrument);
        if (providerSymbol.isEmpty()) {
            return false;
        }
        return isProviderSymbolTradable(providerSymbol.get());
    }

    @Override
    public int countSupported(List<Instrument> instruments) {
        if (instruments == null || instruments.isEmpty()) {
            return 0;
        }
        return (int) instruments.stream().filter(this::supportsInstrument).count();
    }

    @Override
    public Optional<ExternalQuote> fetchLatestPrice(Instrument instrument) {
        if (!supportsInstrument(instrument)) {
            return Optional.empty();
        }

        Optional<String> providerSymbol = toProviderSymbol(instrument);
        if (providerSymbol.isEmpty()) {
            return Optional.empty();
        }
        if (!isProviderSymbolTradable(providerSymbol.get())) {
            return Optional.empty();
        }

        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v3/ticker/price")
                            .queryParam("symbol", providerSymbol.get())
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null || response.path("price").isMissingNode()) {
                return Optional.empty();
            }

            BigDecimal price = new BigDecimal(response.path("price").asText());
            return Optional.of(new ExternalQuote(
                    instrument.getSymbol().toUpperCase(Locale.ROOT),
                    providerSymbol.get(),
                    price,
                    Instant.now(),
                    "BINANCE_REST"
            ));
        } catch (RestClientResponseException ex) {
            markInvalidProviderSymbol(providerSymbol.get(), ex);
            return Optional.empty();
        } catch (IllegalArgumentException | RestClientException ex) {
            log.debug("Could not fetch latest Binance price for {}", instrument.getSymbol(), ex);
            return Optional.empty();
        }
    }

    @Override
    public List<CandleDto> fetchCandles(Instrument instrument, String timeframe, int limit) {
        if (!supportsInstrument(instrument)) {
            return List.of();
        }

        Optional<String> providerSymbol = toProviderSymbol(instrument);
        if (providerSymbol.isEmpty()) {
            return List.of();
        }
        if (!isProviderSymbolTradable(providerSymbol.get())) {
            return List.of();
        }

        String interval = switch (normalizeTimeframe(timeframe)) {
            case "15m" -> "15m";
            case "30m" -> "30m";
            case "1h" -> "1h";
            case "4h" -> "4h";
            case "1d" -> "1d";
            default -> throw new IllegalArgumentException("Unsupported timeframe: " + timeframe);
        };

        int boundedLimit = Math.min(Math.max(limit, 20), 500);

        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v3/klines")
                            .queryParam("symbol", providerSymbol.get())
                            .queryParam("interval", interval)
                            .queryParam("limit", boundedLimit)
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null || !response.isArray()) {
                return List.of();
            }

            List<CandleDto> candles = new ArrayList<>();
            for (JsonNode row : response) {
                if (!row.isArray() || row.size() < 7) {
                    continue;
                }

                Instant closeTime = parseCloseTime(row.get(6));
                if (closeTime == null) {
                    continue;
                }

                try {
                    candles.add(new CandleDto(
                            closeTime,
                            new BigDecimal(row.get(1).asText()),
                            new BigDecimal(row.get(2).asText()),
                            new BigDecimal(row.get(3).asText()),
                            new BigDecimal(row.get(4).asText())
                    ));
                } catch (NumberFormatException ignored) {
                    // Skip malformed row and continue.
                }
            }
            return candles;
        } catch (RestClientResponseException ex) {
            markInvalidProviderSymbol(providerSymbol.get(), ex);
            return List.of();
        } catch (RestClientException ex) {
            log.debug("Could not fetch Binance candles for {}", instrument.getSymbol(), ex);
            return List.of();
        }
    }

    private Optional<String> toProviderSymbol(Instrument instrument) {
        if (instrument == null || instrument.getSymbol() == null) {
            return Optional.empty();
        }

        String symbol = instrument.getSymbol().trim().toUpperCase(Locale.ROOT);
        if (symbol.endsWith("USDT")) {
            return Optional.of(symbol);
        }
        if (symbol.endsWith("USD") && symbol.length() > 3) {
            return Optional.of(symbol.substring(0, symbol.length() - 3) + "USDT");
        }
        return Optional.empty();
    }

    private boolean isProviderSymbolTradable(String providerSymbol) {
        if (!StringUtils.hasText(providerSymbol)) {
            return false;
        }

        if (invalidProviderSymbols.contains(providerSymbol)) {
            return false;
        }

        refreshExchangeInfoIfNeeded();
        if (!exchangeInfoLoaded || tradableProviderSymbols.isEmpty()) {
            return true;
        }
        return tradableProviderSymbols.contains(providerSymbol);
    }

    private void refreshExchangeInfoIfNeeded() {
        Instant now = Instant.now();
        Instant lastRefresh = lastExchangeInfoRefresh;
        if (lastRefresh != null && !lastRefresh.plusSeconds(EXCHANGE_INFO_REFRESH_SECONDS).isBefore(now)) {
            return;
        }
        synchronized (this) {
            Instant recheck = lastExchangeInfoRefresh;
            if (recheck != null && !recheck.plusSeconds(EXCHANGE_INFO_REFRESH_SECONDS).isBefore(Instant.now())) {
                return;
            }
            loadExchangeInfo();
        }
    }

    private void loadExchangeInfo() {
        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/v3/exchangeInfo").build())
                    .retrieve()
                    .body(JsonNode.class);

            Set<String> nextSymbols = ConcurrentHashMap.newKeySet();
            if (response != null && response.path("symbols").isArray()) {
                for (JsonNode symbolNode : response.path("symbols")) {
                    String symbol = symbolNode.path("symbol").asText();
                    String status = symbolNode.path("status").asText();
                    if (StringUtils.hasText(symbol) && "TRADING".equalsIgnoreCase(status)) {
                        nextSymbols.add(symbol.toUpperCase(Locale.ROOT));
                    }
                }
            }

            tradableProviderSymbols.clear();
            tradableProviderSymbols.addAll(nextSymbols);
            exchangeInfoLoaded = !nextSymbols.isEmpty();
            lastExchangeInfoRefresh = Instant.now();

            if (exchangeInfoLoaded) {
                log.info("Loaded {} Binance tradable symbols for market-data mapping", tradableProviderSymbols.size());
            }
        } catch (RestClientException ex) {
            lastExchangeInfoRefresh = Instant.now();
            log.warn("Could not refresh Binance exchangeInfo, keeping fallback symbol detection");
        }
    }

    private void markInvalidProviderSymbol(String providerSymbol, RestClientResponseException ex) {
        if (ex.getStatusCode().value() == 400) {
            invalidProviderSymbols.add(providerSymbol);
            log.info("Binance symbol {} marked as invalid (HTTP 400), leaving instrument without live external feed", providerSymbol);
            return;
        }
        log.debug("Could not fetch Binance data for symbol {}", providerSymbol, ex);
    }

    private String normalizeTimeframe(String timeframe) {
        return (timeframe == null ? "15m" : timeframe.trim().toLowerCase(Locale.ROOT));
    }

    private Instant parseCloseTime(JsonNode closeTimeNode) {
        if (closeTimeNode == null || !closeTimeNode.canConvertToLong()) {
            return null;
        }
        return Instant.ofEpochMilli(closeTimeNode.asLong());
    }
}
