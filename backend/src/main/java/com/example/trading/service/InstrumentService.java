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
import java.time.Instant;

@Service
public class InstrumentService {

    private final InstrumentRepository instrumentRepository;
    private final MarketPriceRepository marketPriceRepository;

    public InstrumentService(InstrumentRepository instrumentRepository, MarketPriceRepository marketPriceRepository) {
        this.instrumentRepository = instrumentRepository;
        this.marketPriceRepository = marketPriceRepository;
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
        int bucketSeconds = resolveBucketSeconds(timeframe);
        int maxCandles = Math.min(Math.max(20, limit), 500);
        int rawLimit = Math.min(120000, Math.max(5000, bucketSeconds * maxCandles));

        List<MarketPrice> rows = marketPriceRepository.findBySymbolOrderByTsDesc(
                symbol.toUpperCase(),
                PageRequest.of(0, rawLimit)
        );

        if (rows.isEmpty()) {
            return List.of();
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

        if (candles.size() <= maxCandles) {
            return candles;
        }
        return candles.subList(candles.size() - maxCandles, candles.size());
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

    private static class CandleAccumulator {
        private final long bucketEpochSeconds;
        private java.math.BigDecimal open;
        private java.math.BigDecimal high;
        private java.math.BigDecimal low;
        private java.math.BigDecimal close;

        private CandleAccumulator(long bucketEpochSeconds) {
            this.bucketEpochSeconds = bucketEpochSeconds;
        }

        private void accept(MarketPrice row) {
            java.math.BigDecimal price = row.getPrice();
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
