package com.example.trading.service;

import com.example.trading.dto.PositionDto;
import com.example.trading.entity.Account;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.example.trading.entity.MarketPrice;
import com.example.trading.entity.Position;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.MarketPriceRepository;
import com.example.trading.repository.PositionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock
    private PositionRepository positionRepository;
    @Mock
    private MarketPriceRepository marketPriceRepository;
    @Mock
    private AccountRepository accountRepository;
    @Mock
    private MarginService marginService;

    @Test
    void shouldUpdateLongPositionRiskLevels() {
        PortfolioService service = new PortfolioService(positionRepository, marketPriceRepository, accountRepository, marginService);
        Position position = longPosition();

        MarketPrice currentPrice = new MarketPrice();
        currentPrice.setPrice(new BigDecimal("105"));

        when(positionRepository.findByAccountIdAndInstrumentSymbolIgnoreCase(10L, "AAPL")).thenReturn(Optional.of(position));
        when(marketPriceRepository.findTopBySymbolOrderByTsDesc("AAPL")).thenReturn(Optional.of(currentPrice));
        when(positionRepository.save(any(Position.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PositionDto result = service.updatePositionRisk(
                10L,
                "AAPL",
                new BigDecimal("120"),
                new BigDecimal("95")
        );

        assertThat(result.getTakeProfit()).isEqualByComparingTo("120");
        assertThat(result.getStopLoss()).isEqualByComparingTo("95");
        verify(positionRepository).save(position);
    }

    @Test
    void shouldRejectLongStopLossAboveCurrentPrice() {
        PortfolioService service = new PortfolioService(positionRepository, marketPriceRepository, accountRepository, marginService);
        Position position = longPosition();

        MarketPrice currentPrice = new MarketPrice();
        currentPrice.setPrice(new BigDecimal("105"));

        when(positionRepository.findByAccountIdAndInstrumentSymbolIgnoreCase(10L, "AAPL")).thenReturn(Optional.of(position));
        when(marketPriceRepository.findTopBySymbolOrderByTsDesc("AAPL")).thenReturn(Optional.of(currentPrice));

        assertThatThrownBy(() -> service.updatePositionRisk(
                10L,
                "AAPL",
                new BigDecimal("120"),
                new BigDecimal("106")
        ))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Stop loss must be below current price for long positions");

        verify(positionRepository, never()).save(any(Position.class));
    }

    private Position longPosition() {
        Account account = new Account();
        account.setId(10L);

        Instrument instrument = new Instrument();
        instrument.setId(20L);
        instrument.setSymbol("AAPL");
        instrument.setType(InstrumentType.STOCK);
        instrument.setLastPrice(new BigDecimal("100"));

        Position position = new Position();
        position.setAccount(account);
        position.setInstrument(instrument);
        position.setQuantity(new BigDecimal("2"));
        position.setAveragePrice(new BigDecimal("100"));
        position.setRealizedPnl(BigDecimal.ZERO);
        return position;
    }
}
