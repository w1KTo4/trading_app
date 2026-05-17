package com.example.trading.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record WalletTransactionDto(
        Long id,
        String type,
        BigDecimal amount,
        BigDecimal balanceBefore,
        BigDecimal balanceAfter,
        String source,
        String correlationId,
        String note,
        Instant createdAt
) {
}
