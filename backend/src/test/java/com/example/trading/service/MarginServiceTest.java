package com.example.trading.service;

import com.example.trading.entity.*;
import com.example.trading.repository.MarketPriceRepository;
import com.example.trading.repository.PositionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarginServiceTest {

    @Mock
    private PositionRepository positionRepository;
    @Mock
    private MarketPriceRepository marketPriceRepository;

    @Test
    void shouldDetectMarginCall() {
        MarginService service = new MarginService(positionRepository, marketPriceRepository);

        Account account = new Account();
        account.setId(1L);
        account.setBalance(new BigDecimal("1000"));

        Instrument instrument = new Instrument();
        instrument.setId(2L);
        instrument.setSymbol("XAUUSD");
        instrument.setType(InstrumentType.CFD);
        instrument.setLeverage(10);
        instrument.setLastPrice(new BigDecimal("100"));

        Position position = new Position();
        position.setAccount(account);
        position.setInstrument(instrument);
        position.setQuantity(new BigDecimal("100"));

        when(positionRepository.findByAccountId(1L)).thenReturn(List.of(position));

        MarketPrice price = new MarketPrice();
        price.setPrice(new BigDecimal("100"));
        when(marketPriceRepository.findTopBySymbolOrderByTsDesc("XAUUSD")).thenReturn(Optional.of(price));

        boolean marginCall = service.isMarginCall(account);
        assertThat(marginCall).isTrue();
    }
}
