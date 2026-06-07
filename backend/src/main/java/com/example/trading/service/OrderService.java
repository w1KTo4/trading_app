package com.example.trading.service;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.dto.PositionDto;
import com.example.trading.dto.PositionRiskUpdateRequest;
import com.example.trading.dto.TradeResponseDto;
import com.example.trading.entity.*;
import com.example.trading.notification.observer.TradingEventPublisher;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.OrderRepository;
import com.example.trading.repository.PositionRepository;
import com.example.trading.repository.TradeRepository;
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
    private final PositionRepository positionRepository;
    private final MarketDataService marketDataService;
    private final MatchingEngineService matchingEngineService;
    private final MarginService marginService;
    private final PortfolioService portfolioService;
    private final TradingEventPublisher eventPublisher;

    public OrderService(OrderRepository orderRepository,
                        TradeRepository tradeRepository,
                        AccountRepository accountRepository,
                        InstrumentRepository instrumentRepository,
                        PositionRepository positionRepository,
                        MarketDataService marketDataService,
                        MatchingEngineService matchingEngineService,
                        MarginService marginService,
                        PortfolioService portfolioService,
                        TradingEventPublisher eventPublisher) {
        this.orderRepository = orderRepository;
        this.tradeRepository = tradeRepository;
        this.accountRepository = accountRepository;
        this.instrumentRepository = instrumentRepository;
        this.positionRepository = positionRepository;
        this.marketDataService = marketDataService;
        this.matchingEngineService = matchingEngineService;
        this.marginService = marginService;
        this.portfolioService = portfolioService;
        this.eventPublisher = eventPublisher;
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
        if (!Boolean.TRUE.equals(instrument.getActive())) {
            throw new IllegalStateException("Instrument is not active");
        }
        if (instrument.getType() != InstrumentType.CRYPTO) {
            throw new IllegalStateException("Trading is available only for crypto instruments");
        }

        BigDecimal currentPrice = marketDataService.getCurrentPrice(instrument.getSymbol())
                .orElse(instrument.getLastPrice());

        validateOrderInput(dto, currentPrice);

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

    @Transactional
    public PositionDto updatePositionRisk(Long accountId,
                                          String symbol,
                                          PositionRiskUpdateRequest request,
                                          String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }

        PositionRiskUpdateRequest safeRequest = request == null ? new PositionRiskUpdateRequest() : request;
        return portfolioService.updatePositionRisk(accountId, symbol, safeRequest.getTakeProfit(), safeRequest.getStopLoss());
    }

    @Transactional
    public OrderResponseDto closePosition(Long accountId, String symbol, String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }

        Position position = positionRepository.findByAccountIdAndInstrumentSymbolIgnoreCase(accountId, symbol)
                .orElseThrow(() -> new NoSuchElementException("Open position not found: " + symbol));

        BigDecimal quantity = position.getQuantity();
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) == 0) {
            throw new NoSuchElementException("Open position not found: " + symbol);
        }

        Instrument instrument = position.getInstrument();
        BigDecimal currentPrice = marketDataService.getCurrentPrice(instrument.getSymbol())
                .orElse(instrument.getLastPrice());
        if (currentPrice == null || currentPrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Current price is not available for closing position");
        }

        OrderEntity closeOrder = new OrderEntity();
        closeOrder.setAccount(account);
        closeOrder.setInstrument(instrument);
        closeOrder.setSide(quantity.compareTo(BigDecimal.ZERO) > 0 ? OrderSide.SELL : OrderSide.BUY);
        closeOrder.setType(OrderType.MARKET);
        closeOrder.setStatus(OrderStatus.NEW);
        closeOrder.setQuantity(quantity.abs());
        closeOrder.setMarginRequired(BigDecimal.ZERO);

        OrderEntity result = matchingEngineService.executeMarketOrder(closeOrder, currentPrice);
        sendOrderUpdate(account.getUser().getEmail(), result);
        return toDto(result);
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

    private void validateOrderInput(OrderRequestDto dto, BigDecimal currentPrice) {
        if (dto.getQuantity() == null || dto.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Quantity must be greater than 0");
        }
        if (dto.getType() == OrderType.LIMIT && dto.getLimitPrice() == null) {
            throw new IllegalArgumentException("Limit price is required for LIMIT order");
        }
        if (dto.getType() == OrderType.MARKET && dto.getLimitPrice() != null) {
            throw new IllegalArgumentException("Limit price must be null for MARKET order");
        }
        if (dto.getLimitPrice() != null && dto.getLimitPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Limit price must be greater than 0");
        }
        if (dto.getTakeProfit() != null && dto.getTakeProfit().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Take profit must be greater than 0");
        }
        if (dto.getStopLoss() != null && dto.getStopLoss().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Stop loss must be greater than 0");
        }

        BigDecimal referencePrice = dto.getType() == OrderType.LIMIT ? dto.getLimitPrice() : currentPrice;
        if (referencePrice == null || referencePrice.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Reference price is not available for order validation");
        }

        if (dto.getTakeProfit() != null) {
            if (dto.getSide() == OrderSide.BUY && dto.getTakeProfit().compareTo(referencePrice) <= 0) {
                throw new IllegalArgumentException("Take profit must be above entry price for BUY orders");
            }
            if (dto.getSide() == OrderSide.SELL && dto.getTakeProfit().compareTo(referencePrice) >= 0) {
                throw new IllegalArgumentException("Take profit must be below entry price for SELL orders");
            }
        }

        if (dto.getStopLoss() != null) {
            if (dto.getSide() == OrderSide.BUY && dto.getStopLoss().compareTo(referencePrice) >= 0) {
                throw new IllegalArgumentException("Stop loss must be below entry price for BUY orders");
            }
            if (dto.getSide() == OrderSide.SELL && dto.getStopLoss().compareTo(referencePrice) <= 0) {
                throw new IllegalArgumentException("Stop loss must be above entry price for SELL orders");
            }
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
        eventPublisher.publishOrderEvent(email, payload);
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
                trade.isClosingTrade(),
                trade.getExecutedAt()
        );
    }
}
