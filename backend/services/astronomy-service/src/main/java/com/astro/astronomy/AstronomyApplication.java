package com.astro.astronomy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AstronomyApplication {
    public static void main(String[] args) {
        SpringApplication.run(AstronomyApplication.class, args);
    }
}
