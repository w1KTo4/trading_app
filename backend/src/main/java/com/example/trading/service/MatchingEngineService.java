package com.example.trading.service;

import com.example.trading.entity.*;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.OrderRepository;
import com.example.trading.repository.PositionRepository;
import com.example.trading.repository.TradeRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MatchingEngineService {

    private final OrderRepository orderRepository;
    private final PositionRepository positionRepository;
    private final TradeRepository tradeRepository;
    private final AccountRepository accountRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public MatchingEngineService(OrderRepository orderRepository,
                                 PositionRepository positionRepository,
                                 TradeRepository tradeRepository,
                                 AccountRepository accountRepository,
                                 SimpMessagingTemplate messagingTemplate) {
        this.orderRepository = orderRepository;
        this.positionRepository = positionRepository;
        this.tradeRepository = tradeRepository;
        this.accountRepository = accountRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public OrderEntity executeMarketOrder(OrderEntity order, BigDecimal executionPrice) {
        order.setFilledPrice(executionPrice);
        order.setStatus(OrderStatus.FILLED);
        OrderEntity savedOrder = orderRepository.save(order);

        BigDecimal realizedPnl = updatePositionAndAccount(savedOrder, executionPrice);

        Trade trade = new Trade();
        trade.setOrder(savedOrder);
        trade.setAccount(savedOrder.getAccount());
        trade.setInstrument(savedOrder.getInstrument());
        trade.setSide(savedOrder.getSide());
        trade.setQuantity(savedOrder.getQuantity());
        trade.setPrice(executionPrice);
        trade.setRealizedPnl(realizedPnl.setScale(6, RoundingMode.HALF_UP));
        trade.setExecutedAt(Instant.now());
        tradeRepository.save(trade);

        sendOrderConfirmation(savedOrder);
        return savedOrder;
    }

    @Transactional
    public void handlePriceTick(Instrument instrument, BigDecimal currentPrice) {
        matchLimitOrders(instrument, currentPrice);
        processTpSl(instrument, currentPrice);
    }

    private void matchLimitOrders(Instrument instrument, BigDecimal currentPrice) {
        List<OrderEntity> pending = orderRepository.findByInstrumentSymbolAndTypeAndStatus(
                instrument.getSymbol(),
                OrderType.LIMIT,
                OrderStatus.NEW
        );

        for (OrderEntity order : pending) {
            boolean shouldFill = false;
            if (order.getSide() == OrderSide.BUY && order.getLimitPrice() != null) {
                shouldFill = currentPrice.compareTo(order.getLimitPrice()) <= 0;
            }
            if (order.getSide() == OrderSide.SELL && order.getLimitPrice() != null) {
                shouldFill = currentPrice.compareTo(order.getLimitPrice()) >= 0;
            }
            if (shouldFill) {
                executeMarketOrder(order, currentPrice);
            }
        }
    }

    private void processTpSl(Instrument instrument, BigDecimal currentPrice) {
        List<Position> positions = positionRepository.findByInstrumentSymbol(instrument.getSymbol());
        for (Position position : positions) {
            BigDecimal qty = position.getQuantity();
            if (qty.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }

            boolean isLong = qty.compareTo(BigDecimal.ZERO) > 0;
            boolean takeProfitHit = isLong
                    ? position.getTakeProfit() != null && currentPrice.compareTo(position.getTakeProfit()) >= 0
                    : position.getTakeProfit() != null && currentPrice.compareTo(position.getTakeProfit()) <= 0;
            boolean stopLossHit = isLong
                    ? position.getStopLoss() != null && currentPrice.compareTo(position.getStopLoss()) <= 0
                    : position.getStopLoss() != null && currentPrice.compareTo(position.getStopLoss()) >= 0;

            if (takeProfitHit || stopLossHit) {
                // Uproszczenie MVP: TP/SL zamyka cala otwarta pozycje po biezacej cenie ticka.
                OrderEntity closeOrder = new OrderEntity();
                closeOrder.setAccount(position.getAccount());
                closeOrder.setInstrument(position.getInstrument());
                closeOrder.setSide(isLong ? OrderSide.SELL : OrderSide.BUY);
                closeOrder.setType(OrderType.MARKET);
                closeOrder.setStatus(OrderStatus.NEW);
                closeOrder.setQuantity(qty.abs());
                closeOrder.setMarginRequired(BigDecimal.ZERO);
                executeMarketOrder(closeOrder, currentPrice);
            }
        }
    }

    private BigDecimal updatePositionAndAccount(OrderEntity order, BigDecimal executionPrice) {
        Account account = order.getAccount();
        Instrument instrument = order.getInstrument();
        BigDecimal signedQty = order.getSide() == OrderSide.BUY ? order.getQuantity() : order.getQuantity().negate();

        Position position = positionRepository.findByAccountIdAndInstrumentId(account.getId(), instrument.getId())
                .orElseGet(() -> {
                    Position p = new Position();
                    p.setAccount(account);
                    p.setInstrument(instrument);
                    p.setQuantity(BigDecimal.ZERO);
                    p.setAveragePrice(BigDecimal.ZERO);
                    p.setRealizedPnl(BigDecimal.ZERO);
                    return p;
                });

        BigDecimal currentQty = position.getQuantity();
        BigDecimal realized = BigDecimal.ZERO;

        if (currentQty.compareTo(BigDecimal.ZERO) == 0 || sameDirection(currentQty, signedQty)) {
            BigDecimal newQty = currentQty.add(signedQty);
            BigDecimal weightedCurrent = position.getAveragePrice().multiply(currentQty.abs());
            BigDecimal weightedNew = executionPrice.multiply(signedQty.abs());
            BigDecimal avg = weightedCurrent.add(weightedNew)
                    .divide(newQty.abs(), 6, RoundingMode.HALF_UP);

            position.setQuantity(newQty);
            position.setAveragePrice(avg);
            applyTpSlFromOrder(position, order);
            positionRepository.save(position);
        } else {
            BigDecimal closingQty = currentQty.abs().min(signedQty.abs());
            realized = calculateRealizedPnl(currentQty, position.getAveragePrice(), executionPrice, closingQty);

            BigDecimal remaining = currentQty.add(signedQty);
            position.setRealizedPnl(position.getRealizedPnl().add(realized));
            account.setBalance(account.getBalance().add(realized));

            if (remaining.compareTo(BigDecimal.ZERO) == 0) {
                positionRepository.delete(position);
            } else {
                position.setQuantity(remaining);
                position.setAveragePrice(signedQty.abs().compareTo(currentQty.abs()) > 0
                        ? executionPrice
                        : position.getAveragePrice());
                applyTpSlFromOrder(position, order);
                positionRepository.save(position);
            }
        }

        accountRepository.save(account);
        return realized;
    }

    private boolean sameDirection(BigDecimal a, BigDecimal b) {
        return (a.compareTo(BigDecimal.ZERO) > 0 && b.compareTo(BigDecimal.ZERO) > 0)
                || (a.compareTo(BigDecimal.ZERO) < 0 && b.compareTo(BigDecimal.ZERO) < 0);
    }

    private BigDecimal calculateRealizedPnl(BigDecimal currentQty,
                                            BigDecimal avgPrice,
                                            BigDecimal closePrice,
                                            BigDecimal closingQty) {
        if (currentQty.compareTo(BigDecimal.ZERO) > 0) {
            return closePrice.subtract(avgPrice).multiply(closingQty);
        }
        return avgPrice.subtract(closePrice).multiply(closingQty);
    }

    private void applyTpSlFromOrder(Position position, OrderEntity order) {
        if (order.getTakeProfit() != null) {
            position.setTakeProfit(order.getTakeProfit());
        }
        if (order.getStopLoss() != null) {
            position.setStopLoss(order.getStopLoss());
        }
    }

    private void sendOrderConfirmation(OrderEntity order) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("orderId", order.getId());
        payload.put("symbol", order.getInstrument().getSymbol());
        payload.put("status", order.getStatus().name());
        payload.put("filledPrice", order.getFilledPrice());
        payload.put("quantity", order.getQuantity());

        messagingTemplate.convertAndSendToUser(order.getAccount().getUser().getEmail(), "/queue/orders", payload);
        messagingTemplate.convertAndSend("/topic/orders/" + order.getAccount().getUser().getEmail(), payload);
    }
}
