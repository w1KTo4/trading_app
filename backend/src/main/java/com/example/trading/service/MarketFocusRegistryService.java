package com.example.trading.service;

import com.example.trading.config.MarketDataProperties;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MarketFocusRegistryService {

    private final MarketDataProperties marketDataProperties;
    private final Map<String, FocusRegistration> focusedSymbolsByOwner = new ConcurrentHashMap<>();

    public MarketFocusRegistryService(MarketDataProperties marketDataProperties) {
        this.marketDataProperties = marketDataProperties;
    }

    public void register(String owner, Collection<String> symbols) {
        if (owner == null || owner.isBlank()) {
            return;
        }

        Set<String> normalized = normalize(symbols);
        if (normalized.isEmpty()) {
            focusedSymbolsByOwner.remove(owner);
            return;
        }

        Instant expiresAt = Instant.now().plusSeconds(marketDataProperties.getFocusTtlSeconds());
        focusedSymbolsByOwner.put(owner, new FocusRegistration(normalized, expiresAt));
    }

    public Set<String> getFocusedSymbols() {
        pruneExpired();
        LinkedHashSet<String> merged = new LinkedHashSet<>();
        for (FocusRegistration registration : focusedSymbolsByOwner.values()) {
            merged.addAll(registration.symbols());
        }
        return merged;
    }

    private Set<String> normalize(Collection<String> symbols) {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        if (symbols == null) {
            return normalized;
        }

        for (String symbol : symbols) {
            if (symbol == null) {
                continue;
            }
            String next = symbol.trim().toUpperCase(Locale.ROOT);
            if (!next.isEmpty()) {
                normalized.add(next);
            }
            if (normalized.size() >= marketDataProperties.getMaxFocusSymbols()) {
                break;
            }
        }
        return normalized;
    }

    private void pruneExpired() {
        Instant now = Instant.now();
        focusedSymbolsByOwner.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private record FocusRegistration(Set<String> symbols, Instant expiresAt) {
    }
}
