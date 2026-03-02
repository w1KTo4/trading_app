package com.example.trading.config;

import com.example.trading.entity.Account;
import com.example.trading.entity.User;
import com.example.trading.entity.UserRole;
import com.example.trading.repository.AccountRepository;
import com.example.trading.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;

@Configuration
public class SeedDataConfig {

    @Bean
    CommandLineRunner seedUsers(UserRepository userRepository,
                                AccountRepository accountRepository,
                                PasswordEncoder passwordEncoder) {
        return args -> {
            upsertUserWithAccount(userRepository, accountRepository, passwordEncoder,
                    "test@test.com", UserRole.USER, new BigDecimal("100000.0000"));
            upsertUserWithAccount(userRepository, accountRepository, passwordEncoder,
                    "admin@test.com", UserRole.ADMIN, new BigDecimal("100000.0000"));
        };
    }

    private void upsertUserWithAccount(UserRepository userRepository,
                                       AccountRepository accountRepository,
                                       PasswordEncoder passwordEncoder,
                                       String email,
                                       UserRole role,
                                       BigDecimal balance) {
        User user = userRepository.findByEmail(email).orElseGet(User::new);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("test123"));
        user.setRole(role);
        User savedUser = userRepository.save(user);

        boolean hasAccount = accountRepository.findByUserId(savedUser.getId()).stream().findFirst().isPresent();
        if (!hasAccount) {
            Account account = new Account();
            account.setUser(savedUser);
            account.setBalance(balance);
            account.setEquity(balance);
            accountRepository.save(account);
        }
    }
}
