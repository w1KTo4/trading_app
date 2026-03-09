package com.example.trading.service;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.dto.TradeResponseDto;
import com.example.trading.entity.*;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.OrderRepository;
import com.example.trading.repository.TradeRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final InstrumentRepository instrumentRepository;
    private final MarketSimulatorService marketSimulatorService;
    private final MatchingEngineService matchingEngineService;
    private final MarginService marginService;
    private final PortfolioService portfolioService;
    private final SimpMessagingTemplate messagingTemplate;

    public OrderService(OrderRepository orderRepository,
                        TradeRepository tradeRepository,
                        AccountRepository accountRepository,
                        InstrumentRepository instrumentRepository,
                        MarketSimulatorService marketSimulatorService,
                        MatchingEngineService matchingEngineService,
                        MarginService marginService,
                        PortfolioService portfolioService,
                        SimpMessagingTemplate messagingTemplate) {
        this.orderRepository = orderRepository;
        this.tradeRepository = tradeRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.marketSimulatorService = marketSimulatorService;
        this.matchingEngineService = matchingEngineService;
        this.marginService = marginService;
        this.portfolioService = portfolioService;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public OrderResponseDto placeOrder(OrderRequestDto dto, String requesterEmail) {
        Account account = accountRepository.findById(dto.getAccountId())
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Account does not belong to authenticated user");
        }

        Instrument instrument = instrumentRepository.findBySymbolIgnoreCase(dto.getSymbol())
                .orElseThrow(() -> new NoSuchElementException("Instrument not found: " + dto.getSymbol()));

        BigDecimal currentPrice = marketSimulatorService.getCurrentPrice(instrument.getSymbol())
                .orElse(instrument.getLastPrice());

        validateOrderInput(dto);

        BigDecimal marginReferencePrice = dto.getType() == OrderType.LIMIT ? dto.getLimitPrice() : currentPrice;
        BigDecimal requiredMargin = marginService.calculateRequiredMargin(instrument, dto.getQuantity(), marginReferencePrice);
        if (!marginService.hasEnoughMargin(account, requiredMargin)) {
            throw new IllegalStateException("Insufficient margin for order");
        }

        OrderEntity order = new OrderEntity();
        order.setAccount(account);
        order.setInstrument(instrument);
        order.setSide(dto.getSide());
        order.setType(dto.getType());
        order.setStatus(OrderStatus.NEW);
        order.setQuantity(dto.getQuantity());
        order.setLimitPrice(dto.getLimitPrice());
        order.setTakeProfit(dto.getTakeProfit());
        order.setStopLoss(dto.getStopLoss());
        order.setMarginRequired(requiredMargin);

        OrderEntity result;
        if (dto.getType() == OrderType.MARKET) {
            result = matchingEngineService.executeMarketOrder(order, currentPrice);
        } else {
            OrderEntity saved = orderRepository.save(order);
            boolean immediateFill = (dto.getSide() == OrderSide.BUY && currentPrice.compareTo(dto.getLimitPrice()) <= 0)
                    || (dto.getSide() == OrderSide.SELL && currentPrice.compareTo(dto.getLimitPrice()) >= 0);
            result = immediateFill ? matchingEngineService.executeMarketOrder(saved, currentPrice) : saved;
        }

        sendOrderUpdate(account.getUser().getEmail(), result);
        return toDto(result);
    }

    @Transactional(readOnly = true)
    public List<OrderResponseDto> getOrdersByAccount(Long accountId, String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }

        return orderRepository.findByAccountIdOrderByCreatedAtDesc(accountId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public Map<String, Object> getPortfolio(Long accountId, String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }

        return portfolioService.getPortfolioSummary(accountId);
    }

    @Transactional(readOnly = true)
    public List<TradeResponseDto> getTradesByAccount(Long accountId, String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }

        return tradeRepository.findByAccountIdOrderByExecutedAtDesc(accountId)
                .stream()
                .map(this::toTradeDto)
                .toList();
    }

    private void validateOrderInput(OrderRequestDto dto) {
        if (dto.getType() == OrderType.LIMIT && dto.getLimitPrice() == null) {
            throw new IllegalArgumentException("Limit price is required for LIMIT order");
        }
        if (dto.getType() == OrderType.MARKET && dto.getLimitPrice() != null) {
            throw new IllegalArgumentException("Limit price must be null for MARKET order");
        }
    }

    private OrderResponseDto toDto(OrderEntity order) {
        return new OrderResponseDto(
                order.getId(),
                order.getInstrument().getSymbol(),
                order.getSide(),
                order.getType(),
                order.getStatus(),
                order.getQuantity(),
                order.getLimitPrice(),
                order.getFilledPrice(),
                order.getTakeProfit(),
                order.getStopLoss(),
                order.getCreatedAt()
        );
    }

    private void sendOrderUpdate(String email, OrderEntity order) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", order.getId());
        payload.put("symbol", order.getInstrument().getSymbol());
        payload.put("status", order.getStatus().name());
        payload.put("filledPrice", order.getFilledPrice());
        messagingTemplate.convertAndSendToUser(email, "/queue/orders", payload);
        messagingTemplate.convertAndSend("/topic/orders/" + email, payload);
    }

    private TradeResponseDto toTradeDto(Trade trade) {
        return new TradeResponseDto(
                trade.getId(),
                trade.getOrder().getId(),
                trade.getInstrument().getSymbol(),
                trade.getSide(),
                trade.getQuantity(),
                trade.getPrice(),
                trade.getRealizedPnl(),
                trade.getExecutedAt()
        );
    }
}
