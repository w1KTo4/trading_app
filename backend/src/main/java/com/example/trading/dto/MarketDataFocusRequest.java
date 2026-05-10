package com.example.trading.dto;

import java.util.List;

public class MarketDataFocusRequest {

    private List<String> symbols = List.of();

    public List<String> getSymbols() {
        return symbols;
    }

    public void setSymbols(List<String> symbols) {
        this.symbols = symbols;
    }
}
