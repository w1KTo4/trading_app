package com.example.trading.service;

import com.example.trading.config.MarketDataProperties;
import com.example.trading.dto.CandleDto;
import com.example.trading.dto.PriceTickDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.MarketPrice;
import com.example.trading.marketdata.strategy.MarketDataProvider;
import com.example.trading.notification.observer.TradingEventPublisher;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
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
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketDataService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataService.class);

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final MatchingEngineService matchingEngineService;
    private final TradingEventPublisher eventPublisher;
    private final MarketDataProvider marketDataProvider;
    private final MarketFocusRegistryService marketFocusRegistryService;
    private final MarketDataProperties marketDataProperties;
    private final Map<String, BigDecimal> currentPrices = new ConcurrentHashMap<>();
    private final Map<String, Instant> lastExternalUpdateAt = new ConcurrentHashMap<>();

    public MarketDataService(InstrumentRepository instrumentRepository,
                             MarketPriceRepository marketPriceRepository,
                             MatchingEngineService matchingEngineService,
                             TradingEventPublisher eventPublisher,
                             MarketDataProvider marketDataProvider,
                             MarketFocusRegistryService marketFocusRegistryService,
                             MarketDataProperties marketDataProperties) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.matchingEngineService = matchingEngineService;
        this.eventPublisher = eventPublisher;
        this.marketDataProvider = marketDataProvider;
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
            if (!marketDataProvider.isEnabled() || !marketDataProvider.supportsInstrument(instrument)) {
                log.info("BOOTSTRAP_SKIP {} -> external crypto feed unavailable", instrument.getSymbol());
                continue;
            }

            List<MarketPrice> history = buildExternalHistory(instrument, timeframe, candleLimit);
            if (history.isEmpty()) {
                log.warn("BOOTSTRAP_EMPTY {} -> no external history available, keeping existing ticks", instrument.getSymbol());
                continue;
            }

            marketPriceRepository.deleteBySymbol(instrument.getSymbol());
            marketPriceRepository.saveAll(history);

            BigDecimal latestPrice = history.get(history.size() - 1).getPrice();
            String symbol = instrument.getSymbol().toUpperCase();
            currentPrices.put(symbol, latestPrice);
            lastExternalUpdateAt.put(symbol, Instant.now());

            instrument.setLastPrice(latestPrice);
            instrumentRepository.save(instrument);

            log.info("BOOTSTRAP_OK {} -> {} points", instrument.getSymbol(), history.size());
        }
    }

    @Scheduled(fixedDelayString = "${market-data.focus-poll-delay-ms:5000}")
    @Transactional
    public void refreshFocusedExternalPrices() {
        if (!marketDataProvider.isEnabled()) {
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
        if (!marketDataProvider.isEnabled()) {
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

    private void publishExternalPriceIfAvailable(Instrument instrument) {
        if (!marketDataProvider.supportsInstrument(instrument)) {
            return;
        }

        marketDataProvider.fetchLatestPrice(instrument)
                .ifPresent(quote -> publishExternalPrice(instrument, quote));
    }

    private void publishExternalPrice(Instrument instrument, MarketDataProvider.ExternalQuote quote) {
        BigDecimal next = normalizePrice(quote.price());
        Instant timestamp = quote.timestamp() == null ? Instant.now() : quote.timestamp();
        publishPrice(instrument, next, timestamp, quote.source());
        lastExternalUpdateAt.put(instrument.getSymbol().toUpperCase(), timestamp);
    }

    private void publishPrice(Instrument instrument, BigDecimal next, Instant timestamp, String source) {
        String symbol = instrument.getSymbol().toUpperCase();
        currentPrices.put(symbol, next);
        instrument.setLastPrice(next);
        instrumentRepository.save(instrument);

        MarketPrice marketPrice = new MarketPrice();
        marketPrice.setInstrument(instrument);
        marketPrice.setSymbol(symbol);
        marketPrice.setPrice(next);
        marketPrice.setTs(timestamp);
        marketPriceRepository.save(marketPrice);

        matchingEngineService.handlePriceTick(instrument, next);
        eventPublisher.publishPriceTick(new PriceTickDto(symbol, next, timestamp, source));
    }

    private BigDecimal normalizePrice(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(6, RoundingMode.HALF_UP);
        }
        return value.setScale(6, RoundingMode.HALF_UP);
    }

    private List<MarketPrice> buildExternalHistory(Instrument instrument, String timeframe, int candleLimit) {
        if (!marketDataProvider.isEnabled() || !marketDataProvider.supportsInstrument(instrument)) {
            return List.of();
        }

        List<CandleDto> candles = marketDataProvider.fetchCandles(instrument, timeframe, candleLimit);
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

}
