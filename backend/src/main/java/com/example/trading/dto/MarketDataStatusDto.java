package com.example.trading.dto;

import java.util.List;

public record MarketDataStatusDto(
        String mode,
        String provider,
        boolean externalEnabled,
        boolean apiKeyConfigured,
        int focusedSymbols,
        int supportedActiveSymbols,
        List<String> focusPreview
) {
}
