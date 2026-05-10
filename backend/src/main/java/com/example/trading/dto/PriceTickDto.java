package com.example.trading.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PriceTickDto {
    private String symbol;
    private BigDecimal price;
    private Instant ts;
    private String source;

    public PriceTickDto(String symbol, BigDecimal price, Instant ts) {
        this(symbol, price, ts, "SIMULATOR");
    }
}
