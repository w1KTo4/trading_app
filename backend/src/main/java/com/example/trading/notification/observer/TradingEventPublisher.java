package com.example.trading.notification.observer;

import com.example.trading.dto.PriceTickDto;

import java.util.Map;

public interface TradingEventPublisher {

    void publishPriceTick(PriceTickDto tick);

    void publishOrderEvent(String email, Map<String, Object> payload);

    void publishPaymentEvent(String email, Map<String, Object> payload);
}
