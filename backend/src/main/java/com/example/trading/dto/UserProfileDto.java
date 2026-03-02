package com.example.trading.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class UserProfileDto {
    private String email;
    private String role;
    private List<Long> accountIds;
}
