package com.example.trading.service;

import com.example.trading.dto.AuthResponse;
import com.example.trading.dto.LoginRequest;
import com.example.trading.dto.RegisterRequest;
import com.example.trading.dto.UserProfileDto;
import com.example.trading.entity.Account;
import com.example.trading.entity.User;
import com.example.trading.entity.UserRole;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.UserRepository;
import com.example.trading.util.JwtUtil;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.NoSuchElementException;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository,
                       AccountRepository accountRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtUtil = jwtUtil;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        User user = new User();
        user.setEmail(request.getEmail().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(UserRole.USER);
        User saved = userRepository.save(user);

        Account account = new Account();
        account.setUser(saved);
        account.setBalance(new BigDecimal("100000.0000"));
        account.setEquity(new BigDecimal("100000.0000"));
        accountRepository.save(account);

        return issueTokens(saved.getEmail());
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail().toLowerCase(), request.getPassword())
        );

        return issueTokens(request.getEmail().toLowerCase());
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtUtil.validateToken(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }
        String email = jwtUtil.getUsername(refreshToken);
        return issueTokens(email);
    }

    @Transactional(readOnly = true)
    public UserProfileDto me(String email) {
        User user = userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> new NoSuchElementException("User not found"));
        var accounts = accountRepository.findByUserId(user.getId()).stream().map(Account::getId).toList();
        return new UserProfileDto(user.getEmail(), user.getRole().name(), accounts);
    }

    private AuthResponse issueTokens(String email) {
        String access = jwtUtil.generateToken(email);
        String refresh = jwtUtil.generateRefreshToken(email);
        return new AuthResponse(access, refresh, "Bearer", email);
    }
}
