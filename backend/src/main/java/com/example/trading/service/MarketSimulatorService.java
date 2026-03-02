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
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketSimulatorService {

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final MatchingEngineService matchingEngineService;
    private final SimpMessagingTemplate messagingTemplate;
    private final Random random = new Random(42L);
    private final Map<String, BigDecimal> currentPrices = new ConcurrentHashMap<>();

    public MarketSimulatorService(InstrumentRepository instrumentRepository,
                                  MarketPriceRepository marketPriceRepository,
                                  MatchingEngineService matchingEngineService,
                                  SimpMessagingTemplate messagingTemplate) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.matchingEngineService = matchingEngineService;
        this.messagingTemplate = messagingTemplate;
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

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void generateTickCycle() {
        List<Instrument> instruments = instrumentRepository.findByActiveTrue();
        Instant now = Instant.now();

        for (Instrument instrument : instruments) {
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
            messagingTemplate.convertAndSend("/topic/prices", new PriceTickDto(instrument.getSymbol(), next, now));
        }
    }
}
