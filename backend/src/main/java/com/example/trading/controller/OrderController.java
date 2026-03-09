package com.example.trading.controller;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.dto.TradeResponseDto;
import com.example.trading.service.OrderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/orders")
    public ResponseEntity<OrderResponseDto> placeOrder(@Valid @RequestBody OrderRequestDto request,
                                                       Authentication authentication) {
        return ResponseEntity.ok(orderService.placeOrder(request, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/orders")
    public ResponseEntity<List<OrderResponseDto>> accountOrders(@PathVariable Long id,
                                                                Authentication authentication) {
        return ResponseEntity.ok(orderService.getOrdersByAccount(id, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/portfolio")
    public ResponseEntity<Map<String, Object>> portfolio(@PathVariable Long id,
                                                         Authentication authentication) {
        return ResponseEntity.ok(orderService.getPortfolio(id, authentication.getName()));
    }

    @GetMapping("/accounts/{id}/trades")
    public ResponseEntity<List<TradeResponseDto>> accountTrades(@PathVariable Long id,
                                                                Authentication authentication) {
        return ResponseEntity.ok(orderService.getTradesByAccount(id, authentication.getName()));
    }
}
