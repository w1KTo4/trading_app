package com.example.trading.dto;

import com.example.trading.entity.InstrumentType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InstrumentDto {
    private Long id;

    @NotBlank
    private String symbol;

    @NotBlank
    private String name;

    @NotNull
    private InstrumentType type;

    @NotNull
    @Min(1)
    private Integer leverage;

    @NotNull
    private BigDecimal lastPrice;

    private Boolean active;
}
