package com.example.trading.dto;

import com.example.trading.entity.OrderStatus;
import com.example.trading.entity.OrderType;
import com.example.trading.entity.OrderSide;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@AllArgsConstructor
public class OrderResponseDto {
    private Long id;
    private String symbol;
    private OrderSide side;
    private OrderType type;
    private OrderStatus status;
    private BigDecimal quantity;
    private BigDecimal limitPrice;
    private BigDecimal filledPrice;
    private BigDecimal takeProfit;
    private BigDecimal stopLoss;
    private Instant createdAt;
}
