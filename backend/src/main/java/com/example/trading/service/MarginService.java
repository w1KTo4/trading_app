package com.example.trading.service;

import com.example.trading.entity.Account;
import com.example.trading.entity.Instrument;
import com.example.trading.entity.InstrumentType;
import com.example.trading.entity.MarketPrice;
import com.example.trading.entity.Position;
import com.example.trading.repository.MarketPriceRepository;
import com.example.trading.repository.PositionRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class MarginService {

    private static final BigDecimal MARGIN_CALL_THRESHOLD = new BigDecimal("0.8");

    private final PositionRepository positionRepository;
    private final MarketPriceRepository marketPriceRepository;

    public MarginService(PositionRepository positionRepository, MarketPriceRepository marketPriceRepository) {
        this.positionRepository = positionRepository;
        this.marketPriceRepository = marketPriceRepository;
    }

    public BigDecimal calculateRequiredMargin(Instrument instrument, BigDecimal quantity, BigDecimal executionPrice) {
        BigDecimal notional = quantity.abs().multiply(executionPrice.abs());
        int leverage = 1;
        if (instrument.getType() == InstrumentType.CFD
                || instrument.getType() == InstrumentType.FOREX
                || instrument.getType() == InstrumentType.METAL
                || instrument.getType() == InstrumentType.INDEX
                || instrument.getType() == InstrumentType.CRYPTO
                || instrument.getType() == InstrumentType.COMMODITY) {
            leverage = Math.max(1, instrument.getLeverage());
        }
        return notional.divide(BigDecimal.valueOf(leverage), 6, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateUsedMargin(Account account) {
        List<Position> positions = positionRepository.findByAccountId(account.getId());
        BigDecimal used = BigDecimal.ZERO;
        for (Position position : positions) {
            if (position.getQuantity().compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            BigDecimal currentPrice = getCurrentPrice(position.getInstrument());
            used = used.add(calculateRequiredMargin(
                    position.getInstrument(),
                    position.getQuantity().abs(),
                    currentPrice
            ));
        }
        return used;
    }

    public boolean hasEnoughMargin(Account account, BigDecimal requiredMargin) {
        BigDecimal used = calculateUsedMargin(account);
        BigDecimal free = account.getBalance().subtract(used);
        return free.compareTo(requiredMargin) >= 0;
    }

    public boolean isMarginCall(Account account) {
        BigDecimal used = calculateUsedMargin(account);
        BigDecimal threshold = account.getBalance().multiply(MARGIN_CALL_THRESHOLD);
        return used.compareTo(threshold) > 0;
    }

    private BigDecimal getCurrentPrice(Instrument instrument) {
        return marketPriceRepository.findTopBySymbolOrderByTsDesc(instrument.getSymbol())
                .map(MarketPrice::getPrice)
                .orElse(instrument.getLastPrice());
    }
}
