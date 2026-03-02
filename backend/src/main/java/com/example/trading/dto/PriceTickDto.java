package com.example.trading.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@AllArgsConstructor
public class PriceTickDto {
    private String symbol;
    private BigDecimal price;
    private Instant ts;
}
