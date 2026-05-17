package com.example.trading.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "market-data")
public class MarketDataProperties {

    private boolean enabled = true;
    private String provider = "binance";
    private String baseUrl = "https://api.binance.com";
    private long focusPollDelayMs = 5000L;
    private long universePollDelayMs = 60000L;
    private long focusTtlSeconds = 120L;
    private int maxFocusSymbols = 8;
    private String bootstrapTimeframe = "15m";
    private int bootstrapCandles = 400;
    private long externalStaleAfterSeconds = 90L;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public long getFocusPollDelayMs() {
        return focusPollDelayMs;
    }

    public void setFocusPollDelayMs(long focusPollDelayMs) {
        this.focusPollDelayMs = focusPollDelayMs;
    }

    public long getUniversePollDelayMs() {
        return universePollDelayMs;
    }

    public void setUniversePollDelayMs(long universePollDelayMs) {
        this.universePollDelayMs = universePollDelayMs;
    }

    public long getFocusTtlSeconds() {
        return focusTtlSeconds;
    }

    public void setFocusTtlSeconds(long focusTtlSeconds) {
        this.focusTtlSeconds = focusTtlSeconds;
    }

    public int getMaxFocusSymbols() {
        return maxFocusSymbols;
    }

    public void setMaxFocusSymbols(int maxFocusSymbols) {
        this.maxFocusSymbols = maxFocusSymbols;
    }

    public String getBootstrapTimeframe() {
        return bootstrapTimeframe;
    }

    public void setBootstrapTimeframe(String bootstrapTimeframe) {
        this.bootstrapTimeframe = bootstrapTimeframe;
    }

    public int getBootstrapCandles() {
        return bootstrapCandles;
    }

    public void setBootstrapCandles(int bootstrapCandles) {
        this.bootstrapCandles = bootstrapCandles;
    }

    public long getExternalStaleAfterSeconds() {
        return externalStaleAfterSeconds;
    }

    public void setExternalStaleAfterSeconds(long externalStaleAfterSeconds) {
        this.externalStaleAfterSeconds = externalStaleAfterSeconds;
    }
}
