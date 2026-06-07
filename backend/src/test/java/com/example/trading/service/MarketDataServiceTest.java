package com.example.trading.service;

import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.example.trading.entity.MarketPrice;
import com.example.trading.config.MarketDataProperties;
import com.example.trading.marketdata.strategy.MarketDataProvider;
import com.example.trading.notification.observer.TradingEventPublisher;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketDataServiceTest {

    @Mock
    private InstrumentRepository instrumentRepository;
    @Mock
    private MarketPriceRepository marketPriceRepository;
    @Mock
    private MatchingEngineService matchingEngineService;
    @Mock
    private TradingEventPublisher eventPublisher;
    @Mock
    private MarketDataProvider marketDataProvider;
    @Mock
    private MarketFocusRegistryService marketFocusRegistryService;
    @Mock
    private MarketDataProperties marketDataProperties;

    @Test
    void shouldRefreshFocusedCryptoFromExternalFeed() {
        Instrument instrument = new Instrument();
        instrument.setId(1L);
        instrument.setSymbol("BTCUSD");
        instrument.setName("Bitcoin / US Dollar");
        instrument.setType(InstrumentType.CRYPTO);
        instrument.setLeverage(2);
        instrument.setLastPrice(new BigDecimal("94000.000000"));
        instrument.setActive(true);

        when(instrumentRepository.findByActiveTrue()).thenReturn(List.of(instrument));
        when(instrumentRepository.save(any(Instrument.class))).thenAnswer(i -> i.getArgument(0));
        when(marketPriceRepository.save(any(MarketPrice.class))).thenAnswer(i -> i.getArgument(0));
        when(marketDataProvider.isEnabled()).thenReturn(true);
        when(marketDataProvider.supportsInstrument(instrument)).thenReturn(true);
        when(marketFocusRegistryService.getFocusedSymbols()).thenReturn(Set.of("BTCUSD"));
        when(marketDataProvider.fetchLatestPrice(instrument)).thenReturn(Optional.of(new MarketDataProvider.ExternalQuote(
                "BTCUSD",
                "BTCUSDT",
                new BigDecimal("95123.450000"),
                Instant.parse("2026-06-07T19:00:00Z"),
                "BINANCE_REST"
        )));

        MarketDataService service = new MarketDataService(
                instrumentRepository,
                marketPriceRepository,
                matchingEngineService,
                eventPublisher,
                marketDataProvider,
                marketFocusRegistryService,
                marketDataProperties
        );

        service.refreshFocusedExternalPrices();

        verify(matchingEngineService, times(1)).handlePriceTick(eq(instrument), eq(new BigDecimal("95123.450000")));
        verify(eventPublisher, times(1)).publishPriceTick(any(com.example.trading.dto.PriceTickDto.class));

        ArgumentCaptor<MarketPrice> captor = ArgumentCaptor.forClass(MarketPrice.class);
        verify(marketPriceRepository).save(captor.capture());
        assertThat(captor.getValue().getSymbol()).isEqualTo("BTCUSD");
        assertThat(captor.getValue().getPrice()).isEqualByComparingTo("95123.450000");
    }
}
