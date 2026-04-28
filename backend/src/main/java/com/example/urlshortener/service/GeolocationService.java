package com.example.urlshortener.service;

import com.example.urlshortener.model.Click;
import com.example.urlshortener.model.ShortUrl;
import com.example.urlshortener.repository.ClickRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.InetAddress;
import java.net.URL;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeolocationService {
    private final ClickRepository clickRepository;
    private final RestTemplate restTemplate;
    private final GeometryFactory geometryFactory = new GeometryFactory();

    @Async
    public void recordClick(ShortUrl shortUrl, String ipAddress) {
        processAndSaveGeolocation(shortUrl, ipAddress, "Click");
    }

    @Async
    public void recordWebsiteLocation(ShortUrl shortUrl) {
        String originalUrl = shortUrl.getOriginalUrl();
        try {
            // Ensure URL has a protocol for parsing
            String normalized = originalUrl.contains("://") ? originalUrl : "https://" + originalUrl;
            URL url = new URL(normalized);
            String host = url.getHost();
            
            log.info("Attempting to resolve website location for host: {}", host);
            InetAddress address = InetAddress.getByName(host);
            String ipAddress = address.getHostAddress();
            
            log.info("Resolved {} to IP {}", host, ipAddress);
            processAndSaveGeolocation(shortUrl, ipAddress, "Website Origin");
        } catch (Exception e) {
            log.warn("Could not resolve website origin for {}: {}. Recording as local fallback.", originalUrl, e.getMessage());
            recordDefaultClick(shortUrl, "0.0.0.0"); // 0.0.0.0 indicates origin resolution failure
        }
    }

    private void processAndSaveGeolocation(ShortUrl shortUrl, String ipAddress, String type) {
        try {
            String url = "http://ip-api.com/json/" + ipAddress;
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response != null && "success".equals(response.get("status"))) {
                double lat = ((Number) response.get("lat")).doubleValue();
                double lon = ((Number) response.get("lon")).doubleValue();
                Point point = geometryFactory.createPoint(new Coordinate(lon, lat));
                point.setSRID(4326);

                Click click = Click.builder()
                        .shortUrl(shortUrl)
                        .ipAddress(ipAddress)
                        .city((String) response.get("city"))
                        .country((String) response.get("country"))
                        .isp((String) response.get("isp") + " (" + type + ")")
                        .location(point)
                        .build();

                clickRepository.save(click);
                log.info("Recorded {} for {} from {}", type, shortUrl.getShortCode(), response.get("city"));
            } else {
                recordDefaultClick(shortUrl, ipAddress);
            }
        } catch (Exception e) {
            log.error("Failed to resolve geolocation for IP: {}", ipAddress, e);
            recordDefaultClick(shortUrl, ipAddress);
        }
    }

    private void recordDefaultClick(ShortUrl shortUrl, String ipAddress) {
        Click click = Click.builder()
                .shortUrl(shortUrl)
                .ipAddress(ipAddress)
                .city("Local")
                .country("Local Network")
                .isp("Private IP Range")
                .build();
        clickRepository.save(click);
    }
}
