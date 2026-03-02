package com.example.trading.service;

import com.example.trading.dto.InstrumentDto;
import com.example.trading.dto.PriceTickDto;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.MarketPrice;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.NoSuchElementException;

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
        List<MarketPrice> rows = marketPriceRepository.findRecentBySymbol(symbol.toUpperCase());
        List<PriceTickDto> data = new ArrayList<>();
        int max = Math.min(rows.size(), Math.max(1, limit));
        for (int i = 0; i < max; i++) {
            MarketPrice mp = rows.get(i);
            data.add(new PriceTickDto(mp.getSymbol(), mp.getPrice(), mp.getTs()));
        }
        Collections.reverse(data);
        return data;
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
}
