package com.example.trading.repository;

import com.example.trading.entity.Position;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {
    Optional<Position> findByAccountIdAndInstrumentId(Long accountId, Long instrumentId);
    List<Position> findByAccountId(Long accountId);
    List<Position> findByInstrumentSymbol(String symbol);
}
