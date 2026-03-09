package com.example.trading.dto;

import com.example.trading.entity.OrderSide;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@AllArgsConstructor
public class TradeResponseDto {
    private Long id;
    private Long orderId;
    private String symbol;
    private OrderSide side;
    private BigDecimal quantity;
    private BigDecimal price;
    private BigDecimal realizedPnl;
    private Instant executedAt;
}
