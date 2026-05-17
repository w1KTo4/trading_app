package com.example.trading.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "trustpay")
public class TrustPayProperties {

    private boolean enabled = true;
    private String submitUrl = "https://trustpay-backend-1orv.onrender.com/api/v1/payments/submit-code";
    private String storeName = "TradingStation";
    private String webhookSecret = "";
    private String devWebhookSecret = "trustpay-local-dev-secret";
    private String publicBaseUrl = "";
    private boolean requireWebhookSignature = false;
    private String webhookSignatureHeader = "x-webhook-signature";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getSubmitUrl() {
        return submitUrl;
    }

    public void setSubmitUrl(String submitUrl) {
        this.submitUrl = submitUrl;
    }

    public String getStoreName() {
        return storeName;
    }

    public void setStoreName(String storeName) {
        this.storeName = storeName;
    }

    public String getWebhookSecret() {
        return webhookSecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public String getDevWebhookSecret() {
        return devWebhookSecret;
    }

    public void setDevWebhookSecret(String devWebhookSecret) {
        this.devWebhookSecret = devWebhookSecret;
    }

    public String getPublicBaseUrl() {
        return publicBaseUrl;
    }

    public void setPublicBaseUrl(String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }

    public boolean isRequireWebhookSignature() {
        return requireWebhookSignature;
    }

    public void setRequireWebhookSignature(boolean requireWebhookSignature) {
        this.requireWebhookSignature = requireWebhookSignature;
    }

    public String getWebhookSignatureHeader() {
        return webhookSignatureHeader;
    }

    public void setWebhookSignatureHeader(String webhookSignatureHeader) {
        this.webhookSignatureHeader = webhookSignatureHeader;
    }
}
