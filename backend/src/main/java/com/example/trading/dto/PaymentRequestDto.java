package com.example.trading.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentRequestDto(
        String correlationId,
        String status,
        BigDecimal amount,
        String storeName,
        String source,
        Instant createdAt,
        Instant finalizedAt
) {
}
