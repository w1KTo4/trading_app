package com.example.trading.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class PositionRiskUpdateRequest {
    private BigDecimal takeProfit;
    private BigDecimal stopLoss;
}
