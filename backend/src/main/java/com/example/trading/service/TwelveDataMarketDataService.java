package com.example.trading.service;

import com.example.trading.config.MarketDataProperties;
import com.example.trading.dto.CandleDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class TwelveDataMarketDataService {

    private static final Logger log = LoggerFactory.getLogger(TwelveDataMarketDataService.class);
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final MarketDataProperties marketDataProperties;
    private final RestClient restClient;

    public TwelveDataMarketDataService(MarketDataProperties marketDataProperties) {
        this.marketDataProperties = marketDataProperties;
        this.restClient = RestClient.builder()
                .baseUrl(marketDataProperties.getBaseUrl())
                .build();
    }

    public boolean isEnabled() {
        return StringUtils.hasText(marketDataProperties.getApiKey());
    }

    public boolean supportsInstrument(Instrument instrument) {
        return toProviderSymbol(instrument).isPresent();
    }

    public int countSupported(List<Instrument> instruments) {
        return (int) instruments.stream().filter(this::supportsInstrument).count();
    }

    public Optional<ExternalQuote> fetchLatestPrice(Instrument instrument) {
        if (!isEnabled()) {
            return Optional.empty();
        }

        Optional<String> providerSymbol = toProviderSymbol(instrument);
        if (providerSymbol.isEmpty()) {
            return Optional.empty();
        }

        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/price")
                            .queryParam("symbol", providerSymbol.get())
                            .queryParam("apikey", marketDataProperties.getApiKey())
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            if (isErrorResponse(response) || response == null || response.path("price").isMissingNode()) {
                return Optional.empty();
            }

            BigDecimal price = new BigDecimal(response.path("price").asText());
            return Optional.of(new ExternalQuote(
                    instrument.getSymbol().toUpperCase(Locale.ROOT),
                    providerSymbol.get(),
                    price,
                    Instant.now(),
                    "TWELVE_DATA"
            ));
        } catch (IllegalArgumentException | RestClientException ex) {
            log.debug("Could not fetch live price for {}", instrument.getSymbol(), ex);
            return Optional.empty();
        }
    }

    public List<CandleDto> fetchCandles(Instrument instrument, String timeframe, int limit) {
        if (!isEnabled()) {
            return List.of();
        }

        Optional<String> providerSymbol = toProviderSymbol(instrument);
        if (providerSymbol.isEmpty()) {
            return List.of();
        }

        String interval = switch (normalizeTimeframe(timeframe)) {
            case "15m" -> "15min";
            case "30m" -> "30min";
            case "1h" -> "1h";
            case "4h" -> "4h";
            case "1d" -> "1day";
            default -> throw new IllegalArgumentException("Unsupported timeframe: " + timeframe);
        };

        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/time_series")
                            .queryParam("symbol", providerSymbol.get())
                            .queryParam("interval", interval)
                            .queryParam("outputsize", Math.min(Math.max(limit, 20), 500))
                            .queryParam("order", "asc")
                            .queryParam("timezone", "UTC")
                            .queryParam("apikey", marketDataProperties.getApiKey())
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            if (isErrorResponse(response) || response == null || !response.path("values").isArray()) {
                return List.of();
            }

            List<CandleDto> candles = new ArrayList<>();
            for (JsonNode value : response.path("values")) {
                Instant time = parseDateTime(value.path("datetime").asText());
                if (time == null) {
                    continue;
                }
                try {
                    candles.add(new CandleDto(
                            time,
                            new BigDecimal(value.path("open").asText()),
                            new BigDecimal(value.path("high").asText()),
                            new BigDecimal(value.path("low").asText()),
                            new BigDecimal(value.path("close").asText())
                    ));
                } catch (NumberFormatException ignored) {
                    // Skip malformed candles rather than failing the full response.
                }
            }
            return candles;
        } catch (RestClientException ex) {
            log.debug("Could not fetch candles for {}", instrument.getSymbol(), ex);
            return List.of();
        }
    }

    private Optional<String> toProviderSymbol(Instrument instrument) {
        String symbol = instrument.getSymbol().toUpperCase(Locale.ROOT);
        InstrumentType type = instrument.getType();

        return switch (type) {
            case STOCK, ETF -> Optional.of(symbol);
            case FOREX, CRYPTO, METAL -> slashCurrencyPair(symbol);
            case INDEX -> Optional.ofNullable(mapIndexSymbol(symbol));
            case COMMODITY -> Optional.ofNullable(mapCommoditySymbol(symbol));
            default -> Optional.empty();
        };
    }

    private Optional<String> slashCurrencyPair(String symbol) {
        if (symbol.length() == 6) {
            return Optional.of(symbol.substring(0, 3) + "/" + symbol.substring(3));
        }
        return Optional.empty();
    }

    private String mapIndexSymbol(String symbol) {
        return switch (symbol) {
            case "US500" -> "GSPC";
            case "NAS100" -> "NDX";
            case "US30" -> "DJI";
            case "GER40" -> "GDAXI";
            case "UK100" -> "FTSE";
            case "JPN225" -> "N225";
            case "AUS200" -> "AXJO";
            case "FRA40" -> "FCHI";
            default -> null;
        };
    }

    private String mapCommoditySymbol(String symbol) {
        return switch (symbol) {
            case "XTIUSD" -> "USOIL";
            case "XBRUSD" -> "UKOIL";
            case "NATGAS" -> "NATGAS";
            case "CORN" -> "CORN";
            case "WHEAT" -> "WHEAT";
            case "COCOA" -> "COCOA";
            default -> null;
        };
    }

    private boolean isErrorResponse(JsonNode response) {
        return response != null && "error".equalsIgnoreCase(response.path("status").asText());
    }

    private String normalizeTimeframe(String timeframe) {
        return (timeframe == null ? "15m" : timeframe.trim().toLowerCase(Locale.ROOT));
    }

    private Instant parseDateTime(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }

        try {
            if (value.length() == 10) {
                return LocalDate.parse(value).atStartOfDay(ZoneOffset.UTC).toInstant();
            }
            return LocalDateTime.parse(value, DATE_TIME_FORMATTER).toInstant(ZoneOffset.UTC);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    public record ExternalQuote(
            String internalSymbol,
            String providerSymbol,
            BigDecimal price,
            Instant timestamp,
            String source
    ) {
    }
}
