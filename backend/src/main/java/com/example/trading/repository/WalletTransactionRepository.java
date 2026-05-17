package com.example.trading.repository;

import com.example.trading.entity.WalletTransaction;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {
    List<WalletTransaction> findByAccountIdOrderByCreatedAtDesc(Long accountId, Pageable pageable);
}
