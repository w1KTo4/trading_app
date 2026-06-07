package com.example.trading.service;

import com.example.trading.config.TrustPayProperties;
import com.example.trading.dto.*;
import com.example.trading.entity.*;
import com.example.trading.notification.observer.TradingEventPublisher;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.PaymentRequestRepository;
import com.example.trading.repository.WalletTransactionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;

@Service
public class FundingService {

    private static final Set<String> TERMINAL_PAYMENT_STATUSES = Set.of("CONFIRMED", "REJECTED", "EXPIRED");

    private final AccountRepository accountRepository;
    private final PaymentRequestRepository paymentRequestRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final TrustPayProperties trustPayProperties;
    private final TradingEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final RestClient restClient = RestClient.builder().build();

    public FundingService(AccountRepository accountRepository,
                          PaymentRequestRepository paymentRequestRepository,
                          WalletTransactionRepository walletTransactionRepository,
                          TrustPayProperties trustPayProperties,
                          TradingEventPublisher eventPublisher,
                          ObjectMapper objectMapper) {
        this.accountRepository = accountRepository;
        this.paymentRequestRepository = paymentRequestRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.trustPayProperties = trustPayProperties;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TrustPaySubmitCodeResponse submitTrustPayCode(Long accountId,
                                                         String requesterEmail,
                                                         TrustPaySubmitCodeRequest request,
                                                         HttpServletRequest httpRequest) {
        if (!trustPayProperties.isEnabled()) {
            throw new IllegalStateException("TrustPay integration is disabled");
        }
        if (!StringUtils.hasText(trustPayProperties.getSubmitUrl())) {
            throw new IllegalStateException("TrustPay submit URL is not configured");
        }
        if (!StringUtils.hasText(trustPayProperties.getStoreName())) {
            throw new IllegalStateException("TrustPay storeName is not configured");
        }

        Account account = requireOwnedAccount(accountId, requesterEmail);
        BigDecimal amount = normalizeAmount(request.getAmount());
        String code = normalizeCode(request.getCode());
        String correlationId = UUID.randomUUID().toString();
        String webhookUrl = buildWebhookUrl(httpRequest, correlationId);
        String webhookSecret = resolveWebhookSecret();

        PaymentRequest paymentRequest = new PaymentRequest();
        paymentRequest.setAccount(account);
        paymentRequest.setCorrelationId(correlationId);
        paymentRequest.setCodeMasked(maskCode(code));
        paymentRequest.setAmount(amount);
        paymentRequest.setStatus(PaymentRequestStatus.SUBMITTED);
        paymentRequest.setStoreName(trustPayProperties.getStoreName().trim());
        paymentRequest.setSource("TRUSTPAY");

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", code);
        payload.put("amount", amount);
        payload.put("storeName", paymentRequest.getStoreName());
        payload.put("webhookUrl", webhookUrl);
        payload.put("webhookSecret", webhookSecret);

        try {
            JsonNode response = restClient.post()
                    .uri(trustPayProperties.getSubmitUrl())
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);

            String requestId = response == null ? null : trimToNull(response.path("requestId").asText());
            paymentRequest.setProviderRequestId(requestId);
            paymentRequestRepository.save(paymentRequest);

            return new TrustPaySubmitCodeResponse(
                    paymentRequest.getCorrelationId(),
                    paymentRequest.getStatus().name(),
                    paymentRequest.getAmount(),
                    paymentRequest.getStoreName()
            );
        } catch (RestClientResponseException ex) {
            paymentRequest.setStatus(PaymentRequestStatus.FAILED);
            paymentRequest.setFinalizedAt(Instant.now());
            paymentRequestRepository.save(paymentRequest);
            throw new IllegalStateException(resolveTrustPayErrorMessage(ex));
        } catch (RestClientException ex) {
            paymentRequest.setStatus(PaymentRequestStatus.FAILED);
            paymentRequest.setFinalizedAt(Instant.now());
            paymentRequestRepository.save(paymentRequest);
            throw new IllegalStateException("Cannot reach TrustPay backend right now");
        }
    }

    @Transactional
    public WalletTransactionDto withdraw(Long accountId, String requesterEmail, WithdrawRequest request) {
        Account account = requireOwnedAccount(accountId, requesterEmail);
        BigDecimal amount = normalizeAmount(request.getAmount());
        if (account.getBalance().compareTo(amount) < 0) {
            throw new IllegalStateException("Insufficient balance for withdrawal");
        }

        BigDecimal balanceBefore = account.getBalance();
        BigDecimal balanceAfter = balanceBefore.subtract(amount).setScale(4, RoundingMode.HALF_UP);
        BigDecimal equityBefore = account.getEquity() == null ? balanceBefore : account.getEquity();
        BigDecimal equityAfter = equityBefore.subtract(amount).setScale(4, RoundingMode.HALF_UP);

        account.setBalance(balanceAfter);
        account.setEquity(equityAfter);
        accountRepository.save(account);

        WalletTransaction tx = new WalletTransaction();
        tx.setAccount(account);
        tx.setType(WalletTransactionType.WITHDRAWAL);
        tx.setAmount(amount.negate().setScale(4, RoundingMode.HALF_UP));
        tx.setBalanceBefore(balanceBefore.setScale(4, RoundingMode.HALF_UP));
        tx.setBalanceAfter(balanceAfter);
        tx.setSource("USER_WITHDRAWAL");
        tx.setCorrelationId(null);
        tx.setNote(trimToNull(request.getNote()));
        walletTransactionRepository.save(tx);

        sendWalletEvent(account.getUser().getEmail(), "WITHDRAWAL_COMPLETED", tx);
        return toWalletDto(tx);
    }

    @Transactional(readOnly = true)
    public FundingOverviewDto getFundingOverview(Long accountId, String requesterEmail) {
        requireOwnedAccount(accountId, requesterEmail);

        List<PaymentRequestDto> paymentRequests = paymentRequestRepository
                .findByAccountIdOrderByCreatedAtDesc(accountId, PageRequest.of(0, 40))
                .stream()
                .map(this::toPaymentRequestDto)
                .toList();

        List<WalletTransactionDto> walletTransactions = walletTransactionRepository
                .findByAccountIdOrderByCreatedAtDesc(accountId, PageRequest.of(0, 60))
                .stream()
                .map(this::toWalletDto)
                .toList();

        return new FundingOverviewDto(paymentRequests, walletTransactions);
    }

    @Transactional
    public void processTrustPayWebhook(String correlationId,
                                       TrustPayWebhookPayload payload,
                                       String providedSignature,
                                       String rawBody) {
        PaymentRequest paymentRequest = paymentRequestRepository.findByCorrelationId(correlationId)
                .orElseThrow(() -> new NoSuchElementException("Unknown correlationId"));

        String normalizedStatus = normalizeStatus(payload.getStatus());
        if (!TERMINAL_PAYMENT_STATUSES.contains(normalizedStatus)) {
            return;
        }

        verifyWebhookSignatureIfRequired(payload, providedSignature, rawBody);

        if (!paymentRequest.getStoreName().equalsIgnoreCase(String.valueOf(payload.getStoreName()).trim())) {
            throw new IllegalArgumentException("Webhook storeName does not match payment request");
        }

        if (paymentRequest.getStatus() == PaymentRequestStatus.CONFIRMED
                || paymentRequest.getStatus() == PaymentRequestStatus.REJECTED
                || paymentRequest.getStatus() == PaymentRequestStatus.EXPIRED) {
            return;
        }

        BigDecimal receivedAmount = normalizeAmount(payload.getAmount());
        if (receivedAmount.compareTo(paymentRequest.getAmount()) != 0) {
            throw new IllegalArgumentException("Webhook amount mismatch");
        }

        paymentRequest.setFinalizedAt(Instant.now());
        paymentRequest.setStatus(mapWebhookStatus(normalizedStatus));
        paymentRequestRepository.save(paymentRequest);

        if (paymentRequest.getStatus() == PaymentRequestStatus.CONFIRMED) {
            applyDeposit(paymentRequest.getAccount(), paymentRequest.getAmount(), paymentRequest.getCorrelationId());
        }

        sendPaymentFinalizedEvent(paymentRequest, normalizedStatus);
    }

    private void applyDeposit(Account account, BigDecimal amount, String correlationId) {
        BigDecimal balanceBefore = account.getBalance();
        BigDecimal balanceAfter = balanceBefore.add(amount).setScale(4, RoundingMode.HALF_UP);
        BigDecimal equityBefore = account.getEquity() == null ? balanceBefore : account.getEquity();
        BigDecimal equityAfter = equityBefore.add(amount).setScale(4, RoundingMode.HALF_UP);

        account.setBalance(balanceAfter);
        account.setEquity(equityAfter);
        accountRepository.save(account);

        WalletTransaction tx = new WalletTransaction();
        tx.setAccount(account);
        tx.setType(WalletTransactionType.DEPOSIT);
        tx.setAmount(amount.setScale(4, RoundingMode.HALF_UP));
        tx.setBalanceBefore(balanceBefore.setScale(4, RoundingMode.HALF_UP));
        tx.setBalanceAfter(balanceAfter);
        tx.setSource("TRUSTPAY");
        tx.setCorrelationId(correlationId);
        tx.setNote("TrustPay webhook confirmation");
        walletTransactionRepository.save(tx);

        sendWalletEvent(account.getUser().getEmail(), "DEPOSIT_CONFIRMED", tx);
    }

    private void verifyWebhookSignatureIfRequired(TrustPayWebhookPayload payload, String providedSignature, String rawBody) {
        if (!trustPayProperties.isRequireWebhookSignature()) {
            return;
        }
        if (!StringUtils.hasText(providedSignature)) {
            throw new IllegalArgumentException("Missing webhook signature");
        }

        String secret = resolveWebhookSecret();
        String content = StringUtils.hasText(rawBody) ? rawBody : serializePayload(payload);
        String expectedSignature = hmacSha256Hex(content, secret);
        if (!constantTimeEquals(expectedSignature, providedSignature.trim())) {
            throw new IllegalArgumentException("Invalid webhook signature");
        }
    }

    private String resolveWebhookSecret() {
        String configured = trimToNull(trustPayProperties.getWebhookSecret());
        if (configured != null) {
            return configured;
        }
        String fallback = trimToNull(trustPayProperties.getDevWebhookSecret());
        if (fallback != null) {
            return fallback;
        }
        throw new IllegalStateException("WEBHOOK_SECRET_TRUSTPAY is not configured");
    }

    private String serializePayload(TrustPayWebhookPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            return "";
        }
    }

    private String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte next : digest) {
                hex.append(String.format("%02x", next));
            }
            return hex.toString();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to verify webhook signature");
        }
    }

    private boolean constantTimeEquals(String expected, String provided) {
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] providedBytes = provided.getBytes(StandardCharsets.UTF_8);
        if (expectedBytes.length != providedBytes.length) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < expectedBytes.length; i++) {
            result |= expectedBytes[i] ^ providedBytes[i];
        }
        return result == 0;
    }

    private void sendPaymentFinalizedEvent(PaymentRequest paymentRequest, String status) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "PAYMENT_FINALIZED");
        event.put("source", "webhook");
        event.put("correlationId", paymentRequest.getCorrelationId());
        event.put("status", status);
        event.put("amount", paymentRequest.getAmount());
        event.put("storeName", paymentRequest.getStoreName());
        event.put("receivedAt", Instant.now());
        event.put("accountId", paymentRequest.getAccount().getId());
        String email = paymentRequest.getAccount().getUser().getEmail();
        eventPublisher.publishPaymentEvent(email, event);
    }

    private void sendWalletEvent(String email, String type, WalletTransaction tx) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("source", tx.getSource());
        event.put("amount", tx.getAmount());
        event.put("balanceAfter", tx.getBalanceAfter());
        event.put("accountId", tx.getAccount().getId());
        event.put("correlationId", tx.getCorrelationId());
        event.put("createdAt", tx.getCreatedAt());
        eventPublisher.publishPaymentEvent(email, event);
    }

    private Account requireOwnedAccount(Long accountId, String requesterEmail) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new NoSuchElementException("Account not found"));
        if (!account.getUser().getEmail().equalsIgnoreCase(requesterEmail)) {
            throw new IllegalStateException("Access denied for account");
        }
        return account;
    }

    private String buildWebhookUrl(HttpServletRequest request, String correlationId) {
        String base = trimToNull(trustPayProperties.getPublicBaseUrl());
        if (base == null) {
            String proto = trimToNull(request.getHeader("X-Forwarded-Proto"));
            if (proto == null) {
                proto = request.getScheme();
            }
            String host = trimToNull(request.getHeader("X-Forwarded-Host"));
            if (host == null) {
                host = request.getHeader("Host");
            }
            base = proto + "://" + host;
        }
        return base.replaceAll("/+$", "") + "/webhook/" + correlationId;
    }

    private String resolveTrustPayErrorMessage(RestClientResponseException ex) {
        String body = trimToNull(ex.getResponseBodyAsString());
        if (body != null) {
            try {
                JsonNode parsed = objectMapper.readTree(body);
                String message = trimToNull(parsed.path("message").asText());
                if (message != null) {
                    return "TrustPay rejected payment code: " + message;
                }
            } catch (Exception ignored) {
                // Fall through to generic message.
            }
        }
        return "TrustPay rejected payment code";
    }

    private PaymentRequestStatus mapWebhookStatus(String normalizedStatus) {
        return switch (normalizedStatus) {
            case "CONFIRMED" -> PaymentRequestStatus.CONFIRMED;
            case "REJECTED" -> PaymentRequestStatus.REJECTED;
            case "EXPIRED" -> PaymentRequestStatus.EXPIRED;
            default -> throw new IllegalArgumentException("Unsupported webhook status");
        };
    }

    private String normalizeStatus(String status) {
        String normalized = trimToNull(status);
        if (normalized == null) {
            throw new IllegalArgumentException("Webhook status is required");
        }
        return normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeCode(String code) {
        String normalized = trimToNull(code);
        if (normalized == null || !normalized.matches("^\\d{6}$")) {
            throw new IllegalArgumentException("Code must contain exactly 6 digits");
        }
        return normalized;
    }

    private String maskCode(String code) {
        if (code == null || code.length() < 2) {
            return "***";
        }
        return "***" + code.substring(code.length() - 2);
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be greater than 0");
        }
        return amount.setScale(4, RoundingMode.HALF_UP);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private WalletTransactionDto toWalletDto(WalletTransaction tx) {
        return new WalletTransactionDto(
                tx.getId(),
                tx.getType().name(),
                tx.getAmount(),
                tx.getBalanceBefore(),
                tx.getBalanceAfter(),
                tx.getSource(),
                tx.getCorrelationId(),
                tx.getNote(),
                tx.getCreatedAt()
        );
    }

    private PaymentRequestDto toPaymentRequestDto(PaymentRequest paymentRequest) {
        return new PaymentRequestDto(
                paymentRequest.getCorrelationId(),
                paymentRequest.getStatus().name(),
                paymentRequest.getAmount(),
                paymentRequest.getStoreName(),
                paymentRequest.getSource(),
                paymentRequest.getCreatedAt(),
                paymentRequest.getFinalizedAt()
        );
    }
}
