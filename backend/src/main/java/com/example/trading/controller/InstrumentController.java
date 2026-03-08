package com.example.trading.controller;

import com.example.trading.dto.CandleDto;
import com.example.trading.dto.InstrumentDto;
import com.example.trading.dto.PriceTickDto;
import com.example.trading.service.InstrumentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InstrumentController {

    private final InstrumentService instrumentService;

    public InstrumentController(InstrumentService instrumentService) {
        this.instrumentService = instrumentService;
    }

    @GetMapping("/instruments")
    public ResponseEntity<List<InstrumentDto>> getAll() {
        return ResponseEntity.ok(instrumentService.getAllActive());
    }

    @GetMapping("/instruments/{symbol}")
    public ResponseEntity<InstrumentDto> getBySymbol(@PathVariable String symbol) {
        return ResponseEntity.ok(instrumentService.getBySymbol(symbol));
    }

    @GetMapping("/instruments/{symbol}/prices")
    public ResponseEntity<List<PriceTickDto>> getRecentPrices(@PathVariable String symbol,
                                                               @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(instrumentService.getRecentPrices(symbol, limit));
    }

    @GetMapping("/instruments/{symbol}/candles")
    public ResponseEntity<List<CandleDto>> getCandles(@PathVariable String symbol,
                                                       @RequestParam(defaultValue = "15m") String timeframe,
                                                       @RequestParam(defaultValue = "250") int limit) {
        return ResponseEntity.ok(instrumentService.getCandles(symbol, timeframe, limit));
    }

    @PostMapping("/admin/instruments")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InstrumentDto> create(@Valid @RequestBody InstrumentDto dto) {
        return ResponseEntity.ok(instrumentService.create(dto));
    }

    @PutMapping("/admin/instruments/{symbol}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<InstrumentDto> update(@PathVariable String symbol, @Valid @RequestBody InstrumentDto dto) {
        return ResponseEntity.ok(instrumentService.update(symbol, dto));
    }

    @DeleteMapping("/admin/instruments/{symbol}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String symbol) {
        instrumentService.delete(symbol);
        return ResponseEntity.noContent().build();
    }
}
