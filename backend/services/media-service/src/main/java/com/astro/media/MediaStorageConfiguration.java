package com.astro.media;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

@Configuration
public class MediaStorageConfiguration {
    @Bean(destroyMethod = "close")
    S3Client mediaS3Client(MediaProperties properties) {
        S3Configuration serviceConfiguration = S3Configuration.builder()
                .pathStyleAccessEnabled(properties.pathStyle())
                .chunkedEncodingEnabled(false)
                .build();
        return S3Client.builder()
                .endpointOverride(properties.endpoint())
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())))
                .region(Region.of(properties.region()))
                .serviceConfiguration(serviceConfiguration)
                .build();
    }
}
