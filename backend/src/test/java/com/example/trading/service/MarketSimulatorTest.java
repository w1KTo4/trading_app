package com.example.trading.service;

import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.example.trading.entity.MarketPrice;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.repository.MarketPriceRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketSimulatorTest {

    @Mock
    private InstrumentRepository instrumentRepository;
    @Mock
    private MarketPriceRepository marketPriceRepository;
    @Mock
    private MatchingEngineService matchingEngineService;
    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Test
    void shouldGenerateTicksAndPublish() {
        Instrument instrument = new Instrument();
        instrument.setId(1L);
        instrument.setSymbol("AAPL");
        instrument.setName("Apple");
        instrument.setType(InstrumentType.STOCK);
        instrument.setLeverage(1);
        instrument.setLastPrice(new BigDecimal("190.000000"));
        instrument.setActive(true);

        when(instrumentRepository.findByActiveTrue()).thenReturn(List.of(instrument));
        when(instrumentRepository.save(any(Instrument.class))).thenAnswer(i -> i.getArgument(0));
        when(marketPriceRepository.save(any(MarketPrice.class))).thenAnswer(i -> i.getArgument(0));

        MarketSimulatorService service = new MarketSimulatorService(
                instrumentRepository,
                marketPriceRepository,
                matchingEngineService,
                messagingTemplate
        );

        service.generateTickCycle();

        verify(matchingEngineService, times(1)).handlePriceTick(eq(instrument), any(BigDecimal.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/prices"), any(com.example.trading.dto.PriceTickDto.class));

        ArgumentCaptor<MarketPrice> captor = ArgumentCaptor.forClass(MarketPrice.class);
        verify(marketPriceRepository).save(captor.capture());
        assertThat(captor.getValue().getSymbol()).isEqualTo("AAPL");
        assertThat(captor.getValue().getPrice()).isNotNull();
    }
}
