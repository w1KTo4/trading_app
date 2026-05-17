package com.example.trading.service;

import com.example.trading.dto.CandleDto;
import com.example.trading.entity.Instrument;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ExternalMarketDataService {

    boolean isEnabled();

    String providerName();

    boolean supportsInstrument(Instrument instrument);

    int countSupported(List<Instrument> instruments);

    Optional<ExternalQuote> fetchLatestPrice(Instrument instrument);

    List<CandleDto> fetchCandles(Instrument instrument, String timeframe, int limit);

    record ExternalQuote(
            String internalSymbol,
            String providerSymbol,
            BigDecimal price,
            Instant timestamp,
            String source
    ) {
    }
}
