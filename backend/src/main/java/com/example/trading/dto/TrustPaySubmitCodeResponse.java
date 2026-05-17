package com.example.trading.dto;

import java.math.BigDecimal;

public record TrustPaySubmitCodeResponse(
        String correlationId,
        String status,
        BigDecimal amount,
        String storeName
) {
}
