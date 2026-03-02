package com.example.trading.repository;

import com.example.trading.entity.OrderEntity;
import com.example.trading.entity.OrderStatus;
import com.example.trading.entity.OrderType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrderRepository extends JpaRepository<OrderEntity, Long> {
    List<OrderEntity> findByAccountIdOrderByCreatedAtDesc(Long accountId);
    List<OrderEntity> findByInstrumentSymbolAndTypeAndStatus(String symbol, OrderType type, OrderStatus status);
}
