package com.example.trading.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "market-data")
public class MarketDataProperties {

    private String apiKey = "";
    private String baseUrl = "https://api.twelvedata.com";
    private long focusPollDelayMs = 5000L;
    private long universePollDelayMs = 60000L;
    private long focusTtlSeconds = 120L;
    private int maxFocusSymbols = 8;

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
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
}
