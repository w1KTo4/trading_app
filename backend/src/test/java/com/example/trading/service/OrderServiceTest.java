package com.example.trading.service;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.entity.*;
import com.example.trading.notification.observer.TradingEventPublisher;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.OrderRepository;
import com.example.trading.repository.PositionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private InstrumentRepository instrumentRepository;
    @Mock
    private PositionRepository positionRepository;
    @Mock
    private MarketDataService marketDataService;
    @Mock
    private MatchingEngineService matchingEngineService;
    @Mock
    private MarginService marginService;
    @Mock
    private PortfolioService portfolioService;
    @Mock
    private TradingEventPublisher eventPublisher;

    @InjectMocks
    private OrderService orderService;

    private Account account;
    private Instrument instrument;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(1L);
        user.setEmail("test@test.com");

        account = new Account();
        account.setId(10L);
        account.setUser(user);
        account.setBalance(new BigDecimal("100000"));

        instrument = new Instrument();
        instrument.setId(20L);
        instrument.setSymbol("BTCUSD");
        instrument.setType(InstrumentType.CRYPTO);
        instrument.setLeverage(2);
        instrument.setLastPrice(new BigDecimal("94000"));
        instrument.setActive(true);
    }

    @Test
    void shouldExecuteMarketOrder() {
        OrderRequestDto request = new OrderRequestDto();
        request.setAccountId(10L);
        request.setSymbol("BTCUSD");
        request.setType(OrderType.MARKET);
        request.setSide(OrderSide.BUY);
        request.setQuantity(new BigDecimal("2"));

        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(instrumentRepository.findBySymbolIgnoreCase("BTCUSD")).thenReturn(Optional.of(instrument));
        when(marketDataService.getCurrentPrice("BTCUSD")).thenReturn(Optional.of(new BigDecimal("95123.50")));
        when(marginService.calculateRequiredMargin(any(), any(), any())).thenReturn(new BigDecimal("383"));
        when(marginService.hasEnoughMargin(any(), any())).thenReturn(true);

        when(matchingEngineService.executeMarketOrder(any(OrderEntity.class), any(BigDecimal.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(99L);
            order.setStatus(OrderStatus.FILLED);
            order.setFilledPrice(invocation.getArgument(1));
            return order;
        });

        OrderResponseDto response = orderService.placeOrder(request, "test@test.com");

        assertThat(response.getId()).isEqualTo(99L);
        assertThat(response.getStatus()).isEqualTo(OrderStatus.FILLED);
        assertThat(response.getFilledPrice()).isEqualByComparingTo("95123.50");

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(matchingEngineService).executeMarketOrder(orderCaptor.capture(), eq(new BigDecimal("95123.50")));
        assertThat(orderCaptor.getValue().getType()).isEqualTo(OrderType.MARKET);
    }

    @Test
    void shouldRejectNonCryptoInstrument() {
        OrderRequestDto request = new OrderRequestDto();
        request.setAccountId(10L);
        request.setSymbol("AAPL");
        request.setType(OrderType.MARKET);
        request.setSide(OrderSide.BUY);
        request.setQuantity(new BigDecimal("1"));

        Instrument stock = new Instrument();
        stock.setId(21L);
        stock.setSymbol("AAPL");
        stock.setType(InstrumentType.STOCK);
        stock.setLeverage(1);
        stock.setLastPrice(new BigDecimal("190"));
        stock.setActive(true);

        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(instrumentRepository.findBySymbolIgnoreCase("AAPL")).thenReturn(Optional.of(stock));

        assertThatThrownBy(() -> orderService.placeOrder(request, "test@test.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Trading is available only for crypto instruments");

        verifyNoInteractions(matchingEngineService);
    }

    @Test
    void shouldRejectInactiveInstrument() {
        OrderRequestDto request = new OrderRequestDto();
        request.setAccountId(10L);
        request.setSymbol("BTCUSD");
        request.setType(OrderType.MARKET);
        request.setSide(OrderSide.BUY);
        request.setQuantity(new BigDecimal("1"));

        instrument.setActive(false);

        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(instrumentRepository.findBySymbolIgnoreCase("BTCUSD")).thenReturn(Optional.of(instrument));

        assertThatThrownBy(() -> orderService.placeOrder(request, "test@test.com"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Instrument is not active");

        verifyNoInteractions(matchingEngineService);
    }

    @Test
    void shouldCloseLongPositionWithSellMarketOrder() {
        Position position = new Position();
        position.setAccount(account);
        position.setInstrument(instrument);
        position.setQuantity(new BigDecimal("3"));
        position.setAveragePrice(new BigDecimal("180"));
        position.setRealizedPnl(BigDecimal.ZERO);

        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(positionRepository.findByAccountIdAndInstrumentSymbolIgnoreCase(10L, "BTCUSD")).thenReturn(Optional.of(position));
        when(marketDataService.getCurrentPrice("BTCUSD")).thenReturn(Optional.of(new BigDecimal("96100.25")));
        when(matchingEngineService.executeMarketOrder(any(OrderEntity.class), any(BigDecimal.class))).thenAnswer(invocation -> {
            OrderEntity order = invocation.getArgument(0);
            order.setId(100L);
            order.setStatus(OrderStatus.FILLED);
            order.setFilledPrice(invocation.getArgument(1));
            return order;
        });

        OrderResponseDto response = orderService.closePosition(10L, "BTCUSD", "test@test.com");

        assertThat(response.getId()).isEqualTo(100L);
        assertThat(response.getSide()).isEqualTo(OrderSide.SELL);
        assertThat(response.getQuantity()).isEqualByComparingTo("3");
        assertThat(response.getFilledPrice()).isEqualByComparingTo("96100.25");

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(matchingEngineService).executeMarketOrder(orderCaptor.capture(), eq(new BigDecimal("96100.25")));
        assertThat(orderCaptor.getValue().getMarginRequired()).isEqualByComparingTo("0");
    }
}
