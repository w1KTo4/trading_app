package com.example.trading.dto;

import com.example.trading.entity.OrderSide;
import com.example.trading.entity.OrderType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class OrderRequestDto {
    @NotNull
    private Long accountId;

    @NotBlank
    private String symbol;

    @NotNull
    private OrderSide side;

    @NotNull
    private OrderType type;

    @NotNull
    @DecimalMin(value = "0.000001", inclusive = true)
    private BigDecimal quantity;

    private BigDecimal limitPrice;
    private BigDecimal takeProfit;
    private BigDecimal stopLoss;
}
