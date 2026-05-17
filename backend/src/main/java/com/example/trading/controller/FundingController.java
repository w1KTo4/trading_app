package com.example.trading.controller;

import com.example.trading.config.TrustPayProperties;
import com.example.trading.dto.*;
import com.example.trading.service.FundingService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class FundingController {

    private final FundingService fundingService;
    private final TrustPayProperties trustPayProperties;
    private final ObjectMapper objectMapper;

    public FundingController(FundingService fundingService,
                             TrustPayProperties trustPayProperties,
                             ObjectMapper objectMapper) {
        this.fundingService = fundingService;
        this.trustPayProperties = trustPayProperties;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/api/accounts/{id}/funding/trustpay/submit-code")
    public ResponseEntity<TrustPaySubmitCodeResponse> submitTrustPayCode(@PathVariable Long id,
                                                                          @Valid @RequestBody TrustPaySubmitCodeRequest request,
                                                                          Authentication authentication,
                                                                          HttpServletRequest httpRequest) {
        return ResponseEntity.ok(fundingService.submitTrustPayCode(id, authentication.getName(), request, httpRequest));
    }

    @PostMapping("/api/accounts/{id}/funding/withdraw")
    public ResponseEntity<WalletTransactionDto> withdraw(@PathVariable Long id,
                                                         @Valid @RequestBody WithdrawRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.ok(fundingService.withdraw(id, authentication.getName(), request));
    }

    @GetMapping("/api/accounts/{id}/funding")
    public ResponseEntity<FundingOverviewDto> getFundingOverview(@PathVariable Long id,
                                                                 Authentication authentication) {
        return ResponseEntity.ok(fundingService.getFundingOverview(id, authentication.getName()));
    }

    @PostMapping("/webhook/{correlationId}")
    public ResponseEntity<Void> receiveTrustPayWebhook(@PathVariable String correlationId,
                                                       @RequestBody String rawBody,
                                                       HttpServletRequest request) {
        TrustPayWebhookPayload payload = parseWebhookPayload(rawBody);
        String signatureHeader = request.getHeader(trustPayProperties.getWebhookSignatureHeader());
        fundingService.processTrustPayWebhook(correlationId, payload, signatureHeader, rawBody);
        return ResponseEntity.ok().build();
    }

    private TrustPayWebhookPayload parseWebhookPayload(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            throw new IllegalArgumentException("Webhook payload is required");
        }
        try {
            return objectMapper.readValue(rawBody, TrustPayWebhookPayload.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Webhook payload is invalid JSON");
        }
    }
}
