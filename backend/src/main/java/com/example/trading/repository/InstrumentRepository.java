package com.example.trading.repository;

import com.example.trading.entity.Instrument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InstrumentRepository extends JpaRepository<Instrument, Long> {
    Optional<Instrument> findBySymbolIgnoreCase(String symbol);
    List<Instrument> findByActiveTrue();
}
