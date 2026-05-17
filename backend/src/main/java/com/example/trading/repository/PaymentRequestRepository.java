package com.example.trading.repository;

import com.example.trading.entity.PaymentRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRequestRepository extends JpaRepository<PaymentRequest, Long> {
    Optional<PaymentRequest> findByCorrelationId(String correlationId);

    List<PaymentRequest> findByAccountIdOrderByCreatedAtDesc(Long accountId, Pageable pageable);
}
