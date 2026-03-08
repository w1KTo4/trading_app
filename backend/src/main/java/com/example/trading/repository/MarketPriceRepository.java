package com.example.trading.repository;

import com.example.trading.entity.MarketPrice;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {
    Optional<MarketPrice> findTopBySymbolOrderByTsDesc(String symbol);

    List<MarketPrice> findBySymbolOrderByTsDesc(String symbol, Pageable pageable);
}
