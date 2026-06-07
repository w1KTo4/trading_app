package com.example.trading.facade;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.dto.PositionDto;
import com.example.trading.dto.PositionRiskUpdateRequest;
import com.example.trading.dto.TradeResponseDto;
import com.example.trading.service.OrderService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TradingFacade {

    private final OrderService orderService;

    public TradingFacade(OrderService orderService) {
        this.orderService = orderService;
    }

    public OrderResponseDto placeOrder(OrderRequestDto request, String requesterEmail) {
        return orderService.placeOrder(request, requesterEmail);
    }

    public List<OrderResponseDto> getOrdersByAccount(Long accountId, String requesterEmail) {
        return orderService.getOrdersByAccount(accountId, requesterEmail);
    }

    public Map<String, Object> getPortfolio(Long accountId, String requesterEmail) {
        return orderService.getPortfolio(accountId, requesterEmail);
    }

    public PositionDto updatePositionRisk(Long accountId,
                                          String symbol,
                                          PositionRiskUpdateRequest request,
                                          String requesterEmail) {
        return orderService.updatePositionRisk(accountId, symbol, request, requesterEmail);
    }

    public OrderResponseDto closePosition(Long accountId, String symbol, String requesterEmail) {
        return orderService.closePosition(accountId, symbol, requesterEmail);
    }

    public List<TradeResponseDto> getTradesByAccount(Long accountId, String requesterEmail) {
        return orderService.getTradesByAccount(accountId, requesterEmail);
    }
}
