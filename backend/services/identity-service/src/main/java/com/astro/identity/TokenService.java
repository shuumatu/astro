package com.astro.identity;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class TokenService {
    private static final List<String> ADMIN_ROLES = List.of("CONTENT_ADMIN");

    private final IdentityProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final String encodedAdminPassword;

    public TokenService(IdentityProperties properties, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder) {
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.encodedAdminPassword = passwordEncoder.encode(properties.adminPassword());
    }

    public TokenResponse issue(TokenRequest request) {
        boolean valid = properties.adminUsername().equals(request.username())
                && passwordEncoder.matches(request.password(), encodedAdminPassword);
        if (!valid) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid username or password");
        }

        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(properties.tokenTtl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("astro-identity")
                .subject(properties.adminUsername())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("roles", ADMIN_ROLES)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new TokenResponse(token, "Bearer", expiresAt, ADMIN_ROLES);
    }
}
