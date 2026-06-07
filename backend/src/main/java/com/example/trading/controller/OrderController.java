package com.example.trading.controller;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.dto.PositionDto;
import com.example.trading.dto.PositionRiskUpdateRequest;
import com.example.trading.dto.TradeResponseDto;
import com.example.trading.facade.TradingFacade;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrderController {

    private final TradingFacade tradingFacade;

    public OrderController(TradingFacade tradingFacade) {
        this.tradingFacade = tradingFacade;
    }

    @PostMapping("/orders")
    public ResponseEntity<OrderResponseDto> placeOrder(@Valid @RequestBody OrderRequestDto request,
                                                       Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.placeOrder(request, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/orders")
    public ResponseEntity<List<OrderResponseDto>> accountOrders(@PathVariable Long id,
                                                                Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.getOrdersByAccount(id, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/portfolio")
    public ResponseEntity<Map<String, Object>> portfolio(@PathVariable Long id,
                                                         Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.getPortfolio(id, authentication.getName()));
    }

    @PatchMapping("/accounts/{id}/positions/{symbol}/risk")
    public ResponseEntity<PositionDto> updatePositionRisk(@PathVariable Long id,
                                                          @PathVariable String symbol,
                                                          @RequestBody PositionRiskUpdateRequest request,
                                                          Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.updatePositionRisk(id, symbol, request, authentication.getName()));
    }

    @PostMapping("/accounts/{id}/positions/{symbol}/close")
    public ResponseEntity<OrderResponseDto> closePosition(@PathVariable Long id,
                                                          @PathVariable String symbol,
                                                          Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.closePosition(id, symbol, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/trades")
    public ResponseEntity<List<TradeResponseDto>> accountTrades(@PathVariable Long id,
                                                                Authentication authentication) {
        return ResponseEntity.ok(tradingFacade.getTradesByAccount(id, authentication.getName()));
    }
}
