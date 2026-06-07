package com.example.trading.notification.observer;

import com.example.trading.dto.PriceTickDto;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class WebSocketTradingEventPublisher implements TradingEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public WebSocketTradingEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @Override
    public void publishPriceTick(PriceTickDto tick) {
        messagingTemplate.convertAndSend("/topic/prices", tick);
    }

    @Override
    public void publishOrderEvent(String email, Map<String, Object> payload) {
        messagingTemplate.convertAndSendToUser(email, "/queue/orders", payload);
        messagingTemplate.convertAndSend("/topic/orders/" + email, payload);
    }

    @Override
    public void publishPaymentEvent(String email, Map<String, Object> payload) {
        messagingTemplate.convertAndSendToUser(email, "/queue/payments", payload);
        messagingTemplate.convertAndSend("/topic/payments/" + email, payload);
    }
}
