package com.example.trading.service;

import com.example.trading.dto.PriceTickDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.MarketPrice;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketSimulatorService {

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final MatchingEngineService matchingEngineService;
    private final SimpMessagingTemplate messagingTemplate;
    private final TwelveDataMarketDataService twelveDataMarketDataService;
    private final MarketFocusRegistryService marketFocusRegistryService;
    private final Random random = new Random(42L);
    private final Map<String, BigDecimal> currentPrices = new ConcurrentHashMap<>();

    public MarketSimulatorService(InstrumentRepository instrumentRepository,
                                  MarketPriceRepository marketPriceRepository,
                                  MatchingEngineService matchingEngineService,
                                  SimpMessagingTemplate messagingTemplate,
                                  TwelveDataMarketDataService twelveDataMarketDataService,
                                  MarketFocusRegistryService marketFocusRegistryService) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.matchingEngineService = matchingEngineService;
        this.messagingTemplate = messagingTemplate;
        this.twelveDataMarketDataService = twelveDataMarketDataService;
        this.marketFocusRegistryService = marketFocusRegistryService;
    }

    @PostConstruct
    public void initPriceCache() {
        List<Instrument> instruments = instrumentRepository.findAll();
        for (Instrument instrument : instruments) {
            BigDecimal price = marketPriceRepository.findTopBySymbolOrderByTsDesc(instrument.getSymbol())
                    .map(MarketPrice::getPrice)
                    .orElse(instrument.getLastPrice());
            currentPrices.put(instrument.getSymbol(), price);
        }
    }

    public Optional<BigDecimal> getCurrentPrice(String symbol) {
        return Optional.ofNullable(currentPrices.get(symbol.toUpperCase()));
    }

    @Scheduled(fixedDelayString = "${market-data.focus-poll-delay-ms:5000}")
    @Transactional
    public void refreshFocusedExternalPrices() {
        if (!twelveDataMarketDataService.isEnabled()) {
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
        if (!twelveDataMarketDataService.isEnabled()) {
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
            if (twelveDataMarketDataService.isEnabled() && twelveDataMarketDataService.supportsInstrument(instrument)) {
                continue;
            }

            BigDecimal last = currentPrices.getOrDefault(instrument.getSymbol(), instrument.getLastPrice());
            BigDecimal ratio = BigDecimal.valueOf((random.nextDouble() - 0.5d) * 0.004d);
            BigDecimal next = last.multiply(BigDecimal.ONE.add(ratio)).setScale(6, RoundingMode.HALF_UP);

            currentPrices.put(instrument.getSymbol(), next);
            instrument.setLastPrice(next);
            instrumentRepository.save(instrument);

            MarketPrice marketPrice = new MarketPrice();
            marketPrice.setInstrument(instrument);
            marketPrice.setSymbol(instrument.getSymbol());
            marketPrice.setPrice(next);
            marketPrice.setTs(now);
            marketPriceRepository.save(marketPrice);

            matchingEngineService.handlePriceTick(instrument, next);
            messagingTemplate.convertAndSend("/topic/prices", new PriceTickDto(instrument.getSymbol(), next, now, "SIMULATOR"));
        }
    }

    private void publishExternalPriceIfAvailable(Instrument instrument) {
        if (!twelveDataMarketDataService.supportsInstrument(instrument)) {
            return;
        }

        twelveDataMarketDataService.fetchLatestPrice(instrument)
                .ifPresent(quote -> publishExternalPrice(instrument, quote));
    }

    private void publishExternalPrice(Instrument instrument, TwelveDataMarketDataService.ExternalQuote quote) {
        BigDecimal next = quote.price().setScale(6, RoundingMode.HALF_UP);
        Instant timestamp = quote.timestamp() == null ? Instant.now() : quote.timestamp();

        currentPrices.put(instrument.getSymbol(), next);
        instrument.setLastPrice(next);
        instrumentRepository.save(instrument);

        MarketPrice marketPrice = new MarketPrice();
        marketPrice.setInstrument(instrument);
        marketPrice.setSymbol(instrument.getSymbol());
        marketPrice.setPrice(next);
        marketPrice.setTs(timestamp);
        marketPriceRepository.save(marketPrice);

        matchingEngineService.handlePriceTick(instrument, next);
        messagingTemplate.convertAndSend("/topic/prices", new PriceTickDto(instrument.getSymbol(), next, timestamp, quote.source()));
    }
}
