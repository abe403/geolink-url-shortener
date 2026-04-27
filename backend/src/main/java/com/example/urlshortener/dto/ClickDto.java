package com.example.urlshortener.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ClickDto {
    private Long id;
    private String ipAddress;
    private String city;
    private String country;
    private String isp;
    private double latitude;
    private double longitude;
    private String timestamp;
}
