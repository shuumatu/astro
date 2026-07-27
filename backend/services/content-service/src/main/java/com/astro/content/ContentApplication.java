package com.astro.content;

import com.astro.content.catalog.MediaUrlProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(MediaUrlProperties.class)
public class ContentApplication {
    public static void main(String[] args) {
        LocalEnvironment.load();
        SpringApplication.run(ContentApplication.class, args);
    }
}
