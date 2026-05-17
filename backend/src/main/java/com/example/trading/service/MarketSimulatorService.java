package com.example.trading.service;

import com.example.trading.config.MarketDataProperties;
import com.example.trading.dto.CandleDto;
import com.example.trading.dto.PriceTickDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.MarketPrice;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketSimulatorService {

    private static final Logger log = LoggerFactory.getLogger(MarketSimulatorService.class);

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final MatchingEngineService matchingEngineService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ExternalMarketDataService externalMarketDataService;
    private final MarketFocusRegistryService marketFocusRegistryService;
    private final MarketDataProperties marketDataProperties;
    private final Random random = new Random(42L);
    private final Map<String, BigDecimal> currentPrices = new ConcurrentHashMap<>();
    private final Map<String, BigDecimal> anchorPrices = new ConcurrentHashMap<>();
    private final Map<String, Double> momentumBySymbol = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastExternalUpdateAt = new ConcurrentHashMap<>();

    public MarketSimulatorService(InstrumentRepository instrumentRepository,
                                  MarketPriceRepository marketPriceRepository,
                                  MatchingEngineService matchingEngineService,
                                  SimpMessagingTemplate messagingTemplate,
                                  ExternalMarketDataService externalMarketDataService,
                                  MarketFocusRegistryService marketFocusRegistryService,
                                  MarketDataProperties marketDataProperties) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.matchingEngineService = matchingEngineService;
        this.messagingTemplate = messagingTemplate;
        this.externalMarketDataService = externalMarketDataService;
        this.marketFocusRegistryService = marketFocusRegistryService;
        this.marketDataProperties = marketDataProperties;
    }

    @PostConstruct
    public void initPriceCache() {
        List<Instrument> instruments = instrumentRepository.findByActiveTrue();
        for (Instrument instrument : instruments) {
            String symbol = instrument.getSymbol().toUpperCase();
            BigDecimal price = marketPriceRepository.findTopBySymbolOrderByTsDesc(symbol)
                    .map(MarketPrice::getPrice)
                    .orElse(instrument.getLastPrice());
            if (price == null) {
                continue;
            }
            BigDecimal normalized = normalizePrice(price);
            currentPrices.put(symbol, normalized);
            anchorPrices.put(symbol, normalized);
            momentumBySymbol.putIfAbsent(symbol, 0.0d);
        }
    }

    public Optional<BigDecimal> getCurrentPrice(String symbol) {
        return Optional.ofNullable(currentPrices.get(symbol.toUpperCase()));
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void bootstrapHistoricalMarketData() {
        String timeframe = marketDataProperties.getBootstrapTimeframe();
        int candleLimit = marketDataProperties.getBootstrapCandles();
        List<Instrument> instruments = instrumentRepository.findByActiveTrue();

        for (Instrument instrument : instruments) {
            List<MarketPrice> history = buildBootstrapHistory(instrument, timeframe, candleLimit);
            if (history.isEmpty()) {
                log.warn("BOOTSTRAP_EMPTY {} -> no history available, keeping existing ticks", instrument.getSymbol());
                continue;
            }

            marketPriceRepository.deleteBySymbol(instrument.getSymbol());
            marketPriceRepository.saveAll(history);

            BigDecimal latestPrice = history.get(history.size() - 1).getPrice();
            String symbol = instrument.getSymbol().toUpperCase();
            currentPrices.put(symbol, latestPrice);
            anchorPrices.put(symbol, latestPrice);
            if (externalMarketDataService.isEnabled() && externalMarketDataService.supportsInstrument(instrument)) {
                lastExternalUpdateAt.put(symbol, Instant.now());
            }

            instrument.setLastPrice(latestPrice);
            instrumentRepository.save(instrument);

            log.info("BOOTSTRAP_OK {} -> {} points", instrument.getSymbol(), history.size());
        }
    }

    @Scheduled(fixedDelayString = "${market-data.focus-poll-delay-ms:5000}")
    @Transactional
    public void refreshFocusedExternalPrices() {
        if (!externalMarketDataService.isEnabled()) {
            return;
        }

        Set<String> focusedSymbols = marketFocusRegistryService.getFocusedSymbols();
        if (focusedSymbols.isEmpty()) {
            return;
        }

        for (Instrument instrument : instrumentRepository.findByActiveTrue()) {
            if (!focusedSymbols.contains(instrument.getSymbol())) {
                continue;
            }
            publishExternalPriceIfAvailable(instrument);
        }
    }

    @Scheduled(fixedDelayString = "${market-data.universe-poll-delay-ms:60000}")
    @Transactional
    public void refreshSupportedUniversePrices() {
        if (!externalMarketDataService.isEnabled()) {
            return;
        }

        Set<String> focusedSymbols = marketFocusRegistryService.getFocusedSymbols();
        for (Instrument instrument : instrumentRepository.findByActiveTrue()) {
            if (focusedSymbols.contains(instrument.getSymbol())) {
                continue;
            }
            publishExternalPriceIfAvailable(instrument);
        }
    }

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void generateTickCycle() {
        List<Instrument> instruments = instrumentRepository.findByActiveTrue();
        Instant now = Instant.now();

        for (Instrument instrument : instruments) {
            String symbol = instrument.getSymbol().toUpperCase();
            if (externalMarketDataService.isEnabled()
                    && externalMarketDataService.supportsInstrument(instrument)
                    && isExternalFresh(symbol, now)) {
                continue;
            }

            BigDecimal last = currentPrices.getOrDefault(symbol, instrument.getLastPrice());
            if (last == null) {
                continue;
            }

            BigDecimal next = simulateNextPrice(symbol, normalizePrice(last));
            publishPrice(instrument, next, now, "SIMULATOR");
        }
    }

    private void publishExternalPriceIfAvailable(Instrument instrument) {
        if (!externalMarketDataService.supportsInstrument(instrument)) {
            return;
        }

        externalMarketDataService.fetchLatestPrice(instrument)
                .ifPresent(quote -> publishExternalPrice(instrument, quote));
    }

    private void publishExternalPrice(Instrument instrument, ExternalMarketDataService.ExternalQuote quote) {
        BigDecimal next = normalizePrice(quote.price());
        Instant timestamp = quote.timestamp() == null ? Instant.now() : quote.timestamp();
        publishPrice(instrument, next, timestamp, quote.source());
        lastExternalUpdateAt.put(instrument.getSymbol().toUpperCase(), timestamp);
    }

    private void publishPrice(Instrument instrument, BigDecimal next, Instant timestamp, String source) {
        String symbol = instrument.getSymbol().toUpperCase();
        currentPrices.put(symbol, next);
        if (!"SIMULATOR".equalsIgnoreCase(source)) {
            anchorPrices.put(symbol, next);
        }
        instrument.setLastPrice(next);
        instrumentRepository.save(instrument);

        MarketPrice marketPrice = new MarketPrice();
        marketPrice.setInstrument(instrument);
        marketPrice.setSymbol(symbol);
        marketPrice.setPrice(next);
        marketPrice.setTs(timestamp);
        marketPriceRepository.save(marketPrice);

        matchingEngineService.handlePriceTick(instrument, next);
        messagingTemplate.convertAndSend("/topic/prices", new PriceTickDto(symbol, next, timestamp, source));
    }

    private boolean isExternalFresh(String symbol, Instant now) {
        Instant last = lastExternalUpdateAt.get(symbol);
        if (last == null) {
            return false;
        }
        long staleAfterSeconds = Math.max(15L, marketDataProperties.getExternalStaleAfterSeconds());
        return !last.plusSeconds(staleAfterSeconds).isBefore(now);
    }

    private BigDecimal simulateNextPrice(String symbol, BigDecimal last) {
        BigDecimal anchor = anchorPrices.computeIfAbsent(symbol, key -> last);
        double anchorValue = anchor.doubleValue();
        double lastValue = last.doubleValue();

        if (!Double.isFinite(anchorValue) || anchorValue <= 0.0d || !Double.isFinite(lastValue) || lastValue <= 0.0d) {
            return last;
        }

        double momentum = momentumBySymbol.getOrDefault(symbol, 0.0d);
        momentum = momentum * 0.84d + random.nextGaussian() * 0.0008d;
        momentumBySymbol.put(symbol, momentum);

        double meanReversion = ((anchorValue - lastValue) / anchorValue) * 0.035d;
        double localVolatility = 0.0012d + Math.abs(momentum) * 0.5d;
        double randomWalk = random.nextGaussian() * localVolatility;
        double spike = random.nextDouble() < 0.012d ? (random.nextDouble() - 0.5d) * 0.03d : 0.0d;

        double ratio = momentum + meanReversion + randomWalk + spike;
        ratio = Math.max(-0.12d, Math.min(0.12d, ratio));

        BigDecimal next = last.multiply(BigDecimal.ONE.add(BigDecimal.valueOf(ratio)));
        BigDecimal floor = last.multiply(new BigDecimal("0.60"));
        BigDecimal ceiling = last.multiply(new BigDecimal("1.40"));
        if (next.compareTo(floor) < 0) {
            next = floor;
        } else if (next.compareTo(ceiling) > 0) {
            next = ceiling;
        }
        BigDecimal normalized = normalizePrice(next);
        BigDecimal driftingAnchor = normalizePrice(
                anchor.multiply(new BigDecimal("0.995")).add(normalized.multiply(new BigDecimal("0.005")))
        );
        anchorPrices.put(symbol, driftingAnchor);
        return normalized;
    }

    private BigDecimal normalizePrice(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        }
        return value.setScale(6, RoundingMode.HALF_UP);
    }

    private List<MarketPrice> buildBootstrapHistory(Instrument instrument, String timeframe, int candleLimit) {
        List<MarketPrice> externalHistory = buildExternalHistory(instrument, timeframe, candleLimit);
        if (!externalHistory.isEmpty()) {
            return externalHistory;
        }
        return buildSyntheticHistory(instrument, timeframe, candleLimit);
    }

    private List<MarketPrice> buildExternalHistory(Instrument instrument, String timeframe, int candleLimit) {
        if (!externalMarketDataService.isEnabled() || !externalMarketDataService.supportsInstrument(instrument)) {
            return List.of();
        }

        List<CandleDto> candles = externalMarketDataService.fetchCandles(instrument, timeframe, candleLimit);
        if (candles.isEmpty()) {
            return List.of();
        }

        List<MarketPrice> history = new ArrayList<>();
        for (CandleDto candle : candles) {
            if (candle == null || candle.getTime() == null || candle.getClose() == null) {
                continue;
            }
            MarketPrice row = new MarketPrice();
            row.setInstrument(instrument);
            row.setSymbol(instrument.getSymbol().toUpperCase());
            row.setPrice(normalizePrice(candle.getClose()));
            row.setTs(candle.getTime());
            history.add(row);
        }
        if (history.size() < 20) {
            return List.of();
        }
        return history;
    }

    private List<MarketPrice> buildSyntheticHistory(Instrument instrument, String timeframe, int candleLimit) {
        int boundedCandles = Math.min(Math.max(candleLimit, 80), 600);
        int bucketSeconds = resolveBucketSeconds(timeframe);
        Instant start = Instant.now().minusSeconds((long) bucketSeconds * (boundedCandles - 1L));
        String symbol = instrument.getSymbol().toUpperCase();

        BigDecimal seedPrice = currentPrices.getOrDefault(symbol, instrument.getLastPrice());
        if (seedPrice == null || seedPrice.compareTo(BigDecimal.ZERO) <= 0) {
            seedPrice = BigDecimal.ONE;
        }

        List<MarketPrice> history = new ArrayList<>(boundedCandles);
        BigDecimal price = normalizePrice(seedPrice.multiply(new BigDecimal("0.97")));
        for (int i = 0; i < boundedCandles; i++) {
            price = simulateNextPrice(symbol, price);
            MarketPrice row = new MarketPrice();
            row.setInstrument(instrument);
            row.setSymbol(symbol);
            row.setPrice(price);
            row.setTs(start.plusSeconds((long) bucketSeconds * i));
            history.add(row);
        }
        log.info("BOOTSTRAP_FALLBACK {} -> generated {} synthetic points", symbol, history.size());
        return history;
    }

    private int resolveBucketSeconds(String timeframe) {
        String tf = (timeframe == null ? "15m" : timeframe.trim().toLowerCase(Locale.ROOT));
        return switch (tf) {
            case "15m" -> 15 * 60;
            case "30m" -> 30 * 60;
            case "1h" -> 60 * 60;
            case "4h" -> 4 * 60 * 60;
            case "1d" -> 24 * 60 * 60;
            default -> 15 * 60;
        };
    }
}
