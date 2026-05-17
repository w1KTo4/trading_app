package com.example.trading.controller;

import com.example.trading.dto.MarketDataFocusRequest;
import com.example.trading.dto.MarketDataStatusDto;
import com.example.trading.repository.InstrumentRepository;
import com.example.trading.service.ExternalMarketDataService;
import com.example.trading.service.MarketFocusRegistryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/market")
public class MarketDataController {

    private final MarketFocusRegistryService marketFocusRegistryService;
    private final ExternalMarketDataService externalMarketDataService;
    private final InstrumentRepository instrumentRepository;

    public MarketDataController(MarketFocusRegistryService marketFocusRegistryService,
                                ExternalMarketDataService externalMarketDataService,
                                InstrumentRepository instrumentRepository) {
        this.marketFocusRegistryService = marketFocusRegistryService;
        this.externalMarketDataService = externalMarketDataService;
        this.instrumentRepository = instrumentRepository;
    }

    @PostMapping("/focus")
    public ResponseEntity<Void> focusSymbols(@RequestBody MarketDataFocusRequest request,
                                             Authentication authentication) {
        marketFocusRegistryService.register(authentication.getName(), request.getSymbols());
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/status")
    public ResponseEntity<MarketDataStatusDto> getStatus() {
        List<String> focusPreview = marketFocusRegistryService.getFocusedSymbols().stream().limit(6).toList();
        boolean externalEnabled = externalMarketDataService.isEnabled();

        return ResponseEntity.ok(new MarketDataStatusDto(
                externalEnabled ? "hybrid-live" : "simulator",
                externalMarketDataService.providerName(),
                externalEnabled,
                externalEnabled,
                focusPreview.size(),
                externalMarketDataService.countSupported(instrumentRepository.findByActiveTrue()),
                focusPreview
        ));
    }
}
