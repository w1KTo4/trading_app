package com.example.trading.service;

import com.example.trading.dto.CandleDto;
import com.example.trading.dto.InstrumentDto;
import com.example.trading.dto.PriceTickDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.MarketPrice;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Comparator;
import java.util.Random;
import java.time.Instant;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class InstrumentService {

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final ExternalMarketDataService externalMarketDataService;

    public InstrumentService(InstrumentRepository instrumentRepository,
                             MarketPriceRepository marketPriceRepository,
                             ExternalMarketDataService externalMarketDataService) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.externalMarketDataService = externalMarketDataService;
    }

    @Transactional(readOnly = true)
    public List<InstrumentDto> getAllActive() {
        return instrumentRepository.findByActiveTrue().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public InstrumentDto getBySymbol(String symbol) {
        Instrument instrument = instrumentRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new NoSuchElementException("Instrument not found: " + symbol));
        return toDto(instrument);
    }

    @Transactional(readOnly = true)
    public List<PriceTickDto> getRecentPrices(String symbol, int limit) {
        int maxRows = Math.min(Math.max(1, limit), 20000);
        List<MarketPrice> rows = marketPriceRepository.findBySymbolOrderByTsDesc(
                symbol.toUpperCase(),
                PageRequest.of(0, maxRows)
        );
        List<PriceTickDto> data = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            MarketPrice mp = rows.get(i);
            data.add(new PriceTickDto(mp.getSymbol(), mp.getPrice(), mp.getTs()));
        }
        Collections.reverse(data);
        return data;
    }

    @Transactional(readOnly = true)
    public List<CandleDto> getCandles(String symbol, String timeframe, int limit) {
        Instrument instrument = instrumentRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new NoSuchElementException("Instrument not found: " + symbol));

        int bucketSeconds = resolveBucketSeconds(timeframe);
        int maxCandles = Math.min(Math.max(20, limit), 500);
        int minimumCandles = Math.min(maxCandles, 80);
        String normalizedSymbol = symbol.toUpperCase(Locale.ROOT);

        List<CandleDto> externalCandles = externalMarketDataService.fetchCandles(instrument, timeframe, limit);
        if (!externalCandles.isEmpty()) {
            return ensureMinimumHistory(
                    normalizedSymbol,
                    trimAndSortCandles(externalCandles, maxCandles),
                    minimumCandles,
                    bucketSeconds,
                    instrument.getLastPrice()
            );
        }

        int rawLimit = Math.min(120000, Math.max(5000, bucketSeconds * maxCandles));

        List<MarketPrice> rows = marketPriceRepository.findBySymbolOrderByTsDesc(
                normalizedSymbol,
                PageRequest.of(0, rawLimit)
        );

        if (rows.isEmpty()) {
            return ensureMinimumHistory(
                    normalizedSymbol,
                    List.of(),
                    minimumCandles,
                    bucketSeconds,
                    instrument.getLastPrice()
            );
        }

        Collections.reverse(rows);
        Map<Long, CandleAccumulator> grouped = new LinkedHashMap<>();

        for (MarketPrice row : rows) {
            long epoch = row.getTs().getEpochSecond();
            long bucketEpoch = (epoch / bucketSeconds) * bucketSeconds;
            CandleAccumulator acc = grouped.computeIfAbsent(bucketEpoch, key -> new CandleAccumulator(bucketEpoch));
            acc.accept(row);
        }

        List<CandleDto> candles = grouped.values().stream()
                .map(CandleAccumulator::toDto)
                .toList();

        List<CandleDto> boundedCandles;
        if (candles.size() <= maxCandles) {
            boundedCandles = candles;
        } else {
            boundedCandles = candles.subList(candles.size() - maxCandles, candles.size());
        }

        return ensureMinimumHistory(
                normalizedSymbol,
                boundedCandles,
                minimumCandles,
                bucketSeconds,
                instrument.getLastPrice()
        );
    }

    @Transactional
    public InstrumentDto create(InstrumentDto dto) {
        Instrument instrument = new Instrument();
        apply(instrument, dto);
        return toDto(instrumentRepository.save(instrument));
    }

    @Transactional
    public InstrumentDto update(String symbol, InstrumentDto dto) {
        Instrument instrument = instrumentRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new NoSuchElementException("Instrument not found: " + symbol));
        apply(instrument, dto);
        return toDto(instrumentRepository.save(instrument));
    }

    @Transactional
    public void delete(String symbol) {
        Instrument instrument = instrumentRepository.findBySymbolIgnoreCase(symbol)
                .orElseThrow(() -> new NoSuchElementException("Instrument not found: " + symbol));
        instrument.setActive(false);
        instrumentRepository.save(instrument);
    }

    private void apply(Instrument instrument, InstrumentDto dto) {
        instrument.setSymbol(dto.getSymbol().toUpperCase());
        instrument.setName(dto.getName());
        instrument.setType(dto.getType());
        instrument.setLeverage(dto.getLeverage());
        instrument.setLastPrice(dto.getLastPrice());
        instrument.setActive(dto.getActive() == null ? true : dto.getActive());
    }

    private InstrumentDto toDto(Instrument instrument) {
        InstrumentDto dto = new InstrumentDto();
        dto.setId(instrument.getId());
        dto.setSymbol(instrument.getSymbol());
        dto.setName(instrument.getName());
        dto.setType(instrument.getType());
        dto.setLeverage(instrument.getLeverage());
        dto.setLastPrice(instrument.getLastPrice());
        dto.setActive(instrument.getActive());
        return dto;
    }

    private int resolveBucketSeconds(String timeframe) {
        String tf = (timeframe == null ? "15m" : timeframe.trim().toLowerCase(Locale.ROOT));
        return switch (tf) {
            case "15m" -> 15 * 60;
            case "30m" -> 30 * 60;
            case "1h" -> 60 * 60;
            case "4h" -> 4 * 60 * 60;
            case "1d" -> 24 * 60 * 60;
            default -> throw new IllegalArgumentException("Unsupported timeframe: " + timeframe);
        };
    }

    private List<CandleDto> trimAndSortCandles(List<CandleDto> source, int maxCandles) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }

        List<CandleDto> sorted = source.stream()
                .filter(this::isCandleUsable)
                .sorted(Comparator.comparing(CandleDto::getTime))
                .toList();

        if (sorted.size() <= maxCandles) {
            return sorted;
        }
        return sorted.subList(sorted.size() - maxCandles, sorted.size());
    }

    private List<CandleDto> ensureMinimumHistory(String symbol,
                                                 List<CandleDto> sourceCandles,
                                                 int minimumCandles,
                                                 int bucketSeconds,
                                                 BigDecimal fallbackPrice) {
        List<CandleDto> sortedCandles = trimAndSortCandles(sourceCandles, 500);
        if (sortedCandles.size() >= minimumCandles) {
            return sortedCandles;
        }

        int missingCandles = Math.max(0, minimumCandles - sortedCandles.size());
        long randomSeed = (long) symbol.hashCode() * 31L + bucketSeconds;
        Random random = new Random(randomSeed);

        List<CandleDto> result = new ArrayList<>(minimumCandles);
        if (sortedCandles.isEmpty()) {
            result.addAll(buildSyntheticTimeline(minimumCandles, bucketSeconds, fallbackPrice, random));
            return result;
        }

        CandleDto firstRealCandle = sortedCandles.get(0);
        result.addAll(buildSyntheticPrefix(firstRealCandle, missingCandles, bucketSeconds, random));
        result.addAll(sortedCandles);
        return result;
    }

    private List<CandleDto> buildSyntheticTimeline(int candlesCount,
                                                   int bucketSeconds,
                                                   BigDecimal fallbackPrice,
                                                   Random random) {
        List<CandleDto> generated = new ArrayList<>(candlesCount);
        BigDecimal currentOpen = sanitizePrice(fallbackPrice);
        Instant start = Instant.now().minusSeconds((long) bucketSeconds * (candlesCount - 1L));

        for (int i = 0; i < candlesCount; i++) {
            Instant candleTime = start.plusSeconds((long) bucketSeconds * i);
            BigDecimal close = evolvePrice(currentOpen, random);
            generated.add(buildCandle(candleTime, currentOpen, close, random));
            currentOpen = close;
        }

        return generated;
    }

    private List<CandleDto> buildSyntheticPrefix(CandleDto firstCandle,
                                                 int missingCandles,
                                                 int bucketSeconds,
                                                 Random random) {
        if (missingCandles <= 0) {
            return List.of();
        }

        List<CandleDto> prefix = new ArrayList<>(missingCandles);
        BigDecimal nextOpen = sanitizePrice(firstCandle.getOpen());

        for (int offset = missingCandles; offset >= 1; offset--) {
            Instant candleTime = firstCandle.getTime().minusSeconds((long) bucketSeconds * offset);
            BigDecimal open = evolveBackwardOpen(nextOpen, random);
            BigDecimal close = nextOpen;
            prefix.add(buildCandle(candleTime, open, close, random));
            nextOpen = open;
        }

        return prefix;
    }

    private CandleDto buildCandle(Instant time, BigDecimal open, BigDecimal close, Random random) {
        BigDecimal normalizedOpen = sanitizePrice(open);
        BigDecimal normalizedClose = sanitizePrice(close);

        double wickUp = 0.0005d + random.nextDouble() * 0.0025d;
        double wickDown = 0.0005d + random.nextDouble() * 0.0025d;

        BigDecimal highBase = normalizedOpen.max(normalizedClose);
        BigDecimal lowBase = normalizedOpen.min(normalizedClose);

        BigDecimal high = normalizePrice(highBase.multiply(BigDecimal.ONE.add(BigDecimal.valueOf(wickUp))));
        BigDecimal low = normalizePrice(lowBase.multiply(BigDecimal.ONE.subtract(BigDecimal.valueOf(wickDown))));

        if (low.compareTo(BigDecimal.ZERO) <= 0) {
            low = normalizePrice(lowBase.multiply(new BigDecimal("0.98")));
        }
        if (high.compareTo(normalizedOpen) < 0) {
            high = normalizedOpen;
        }
        if (high.compareTo(normalizedClose) < 0) {
            high = normalizedClose;
        }
        if (low.compareTo(normalizedOpen) > 0) {
            low = normalizedOpen;
        }
        if (low.compareTo(normalizedClose) > 0) {
            low = normalizedClose;
        }

        return new CandleDto(time, normalizedOpen, high, low, normalizedClose);
    }

    private BigDecimal evolvePrice(BigDecimal open, Random random) {
        double shock = clamp(random.nextGaussian() * 0.0022d, -0.03d, 0.03d);
        BigDecimal close = sanitizePrice(open).multiply(BigDecimal.ONE.add(BigDecimal.valueOf(shock)));
        return sanitizePrice(close);
    }

    private BigDecimal evolveBackwardOpen(BigDecimal nextOpen, Random random) {
        double drift = clamp(random.nextGaussian() * 0.0022d, -0.03d, 0.03d);
        double denominator = 1.0d + drift;
        if (denominator < 0.05d) {
            denominator = 0.05d;
        }
        BigDecimal open = sanitizePrice(nextOpen).divide(BigDecimal.valueOf(denominator), 6, RoundingMode.HALF_UP);
        return sanitizePrice(open);
    }

    private boolean isCandleUsable(CandleDto candle) {
        return candle != null
                && candle.getTime() != null
                && candle.getOpen() != null
                && candle.getHigh() != null
                && candle.getLow() != null
                && candle.getClose() != null;
    }

    private BigDecimal sanitizePrice(BigDecimal price) {
        if (price == null || price.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ONE.setScale(6, RoundingMode.HALF_UP);
        }
        return normalizePrice(price);
    }

    private BigDecimal normalizePrice(BigDecimal price) {
        return price.setScale(6, RoundingMode.HALF_UP);
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static class CandleAccumulator {
        private final long bucketEpochSeconds;
        private BigDecimal open;
        private BigDecimal high;
        private BigDecimal low;
        private BigDecimal close;

        private CandleAccumulator(long bucketEpochSeconds) {
            this.bucketEpochSeconds = bucketEpochSeconds;
        }

        private void accept(MarketPrice row) {
            BigDecimal price = row.getPrice();
            if (open == null) {
                open = price;
                high = price;
                low = price;
                close = price;
                return;
            }
            if (price.compareTo(high) > 0) {
                high = price;
            }
            if (price.compareTo(low) < 0) {
                low = price;
            }
            close = price;
        }

        private CandleDto toDto() {
            return new CandleDto(
                    Instant.ofEpochSecond(bucketEpochSeconds),
                    open,
                    high,
                    low,
                    close
            );
        }
    }
}
