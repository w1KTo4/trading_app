package com.example.trading.service;

import com.example.trading.dto.OrderRequestDto;
import com.example.trading.dto.OrderResponseDto;
import com.example.trading.entity.*;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.Optional;

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
    private MarketSimulatorService marketSimulatorService;
    @Mock
    private MatchingEngineService matchingEngineService;
    @Mock
    private MarginService marginService;
    @Mock
    private PortfolioService portfolioService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

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
        instrument.setSymbol("AAPL");
        instrument.setType(InstrumentType.STOCK);
        instrument.setLeverage(1);
        instrument.setLastPrice(new BigDecimal("190"));
    }

    @Test
    void shouldExecuteMarketOrder() {
        OrderRequestDto request = new OrderRequestDto();
        request.setAccountId(10L);
        request.setSymbol("AAPL");
        request.setType(OrderType.MARKET);
        request.setSide(OrderSide.BUY);
        request.setQuantity(new BigDecimal("2"));

        when(accountRepository.findById(10L)).thenReturn(Optional.of(account));
        when(instrumentRepository.findBySymbolIgnoreCase("AAPL")).thenReturn(Optional.of(instrument));
        when(marketSimulatorService.getCurrentPrice("AAPL")).thenReturn(Optional.of(new BigDecimal("191.50")));
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
        assertThat(response.getFilledPrice()).isEqualByComparingTo("191.50");

        ArgumentCaptor<OrderEntity> orderCaptor = ArgumentCaptor.forClass(OrderEntity.class);
        verify(matchingEngineService).executeMarketOrder(orderCaptor.capture(), eq(new BigDecimal("191.50")));
        assertThat(orderCaptor.getValue().getType()).isEqualTo(OrderType.MARKET);
    }
}
