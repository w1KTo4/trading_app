package com.example.trading.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class TrustPayWebhookPayload {
    private String status;
    private BigDecimal amount;
    private String storeName;
}
