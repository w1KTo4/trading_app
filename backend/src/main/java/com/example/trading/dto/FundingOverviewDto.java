package com.example.trading.dto;

import java.util.List;

public record FundingOverviewDto(
        List<PaymentRequestDto> paymentRequests,
        List<WalletTransactionDto> walletTransactions
) {
}
