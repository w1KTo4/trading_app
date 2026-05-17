package com.example.trading.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TrustPaySubmitCodeRequest {

    @NotBlank
    @Pattern(regexp = "^\\d{6}$", message = "Code must contain exactly 6 digits")
    private String code;

    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;
}
