package com.example.trading.repository;

import com.example.trading.entity.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {
    Optional<MarketPrice> findTopBySymbolOrderByTsDesc(String symbol);

    @Query("""
            select mp from MarketPrice mp
            where mp.symbol = :symbol
            order by mp.ts desc
            """)
    List<MarketPrice> findRecentBySymbol(@Param("symbol") String symbol);
}
