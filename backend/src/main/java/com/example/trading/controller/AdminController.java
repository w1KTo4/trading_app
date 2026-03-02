package com.example.trading.controller;

import com.example.trading.repository.AccountRepository;
import com.example.trading.service.MarketSimulatorService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AccountRepository accountRepository;
    private final MarketSimulatorService marketSimulatorService;

    public AdminController(AccountRepository accountRepository,
                           MarketSimulatorService marketSimulatorService) {
        this.accountRepository = accountRepository;
        this.marketSimulatorService = marketSimulatorService;
    }

    @GetMapping("/accounts")
    public ResponseEntity<List<Map<String, Object>>> accounts() {
        List<Map<String, Object>> payload = accountRepository.findAll().stream().map(account -> {
            Map<String, Object> row = new HashMap<>();
            row.put("id", account.getId());
            row.put("balance", account.getBalance());
            row.put("equity", account.getEquity());
            return row;
        }).toList();
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/simulate-tick")
    public ResponseEntity<Map<String, Object>> simulateTick() {
        marketSimulatorService.generateTickCycle();
        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("message", "Tick cycle executed manually");
        return ResponseEntity.ok(response);
    }
}
