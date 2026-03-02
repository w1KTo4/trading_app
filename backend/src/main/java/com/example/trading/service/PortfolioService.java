package com.example.trading.service;

import com.example.trading.dto.PositionDto;
import com.example.trading.entity.Account;
import com.example.trading.entity.MarketPrice;
import com.example.trading.entity.Position;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.MarketPriceRepository;
import com.example.trading.repository.PositionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class PortfolioService {

    private final PositionRepository positionRepository;
    private final MarketPriceRepository marketPriceRepository;
    private final AccountRepository accountRepository;
    private final MarginService marginService;

    public PortfolioService(PositionRepository positionRepository,
                            MarketPriceRepository marketPriceRepository,
                            AccountRepository accountRepository,
                            MarginService marginService) {
        this.positionRepository = positionRepository;
        this.marketPriceRepository = marketPriceRepository;
        this.accountRepository = accountRepository;
        this.marginService = marginService;
    }

    @Transactional(readOnly = true)
    public List<PositionDto> getPositions(Long accountId) {
        return positionRepository.findByAccountId(accountId).stream()
                .filter(p -> p.getQuantity().compareTo(BigDecimal.ZERO) != 0)
                .map(this::toPositionDto)
                .toList();
    }

    @Transactional
    public Map<String, Object> getPortfolioSummary(Long accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));

        List<PositionDto> positions = getPositions(accountId);
        BigDecimal unrealized = positions.stream()
                .map(PositionDto::getUnrealizedPnl)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal equity = account.getBalance().add(unrealized);
        account.setEquity(equity);
        accountRepository.save(account);

        BigDecimal usedMargin = marginService.calculateUsedMargin(account);
        boolean marginCall = marginService.isMarginCall(account);

        Map<String, Object> summary = new HashMap<>();
        summary.put("accountId", account.getId());
        summary.put("balance", account.getBalance());
        summary.put("equity", equity);
        summary.put("usedMargin", usedMargin);
        summary.put("marginCall", marginCall);
        summary.put("positions", positions);
        return summary;
    }

    private PositionDto toPositionDto(Position position) {
        BigDecimal current = marketPriceRepository.findTopBySymbolOrderByTsDesc(position.getInstrument().getSymbol())
                .map(MarketPrice::getPrice)
                .orElse(position.getInstrument().getLastPrice());

        BigDecimal qty = position.getQuantity();
        BigDecimal pnl;
        if (qty.compareTo(BigDecimal.ZERO) > 0) {
            pnl = current.subtract(position.getAveragePrice()).multiply(qty);
        } else {
            pnl = position.getAveragePrice().subtract(current).multiply(qty.abs());
        }

        return new PositionDto(
                position.getInstrument().getSymbol(),
                qty,
                position.getAveragePrice(),
                current,
                pnl,
                position.getRealizedPnl()
        );
    }
}
