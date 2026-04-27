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
        try {
            URL url = new URL(shortUrl.getOriginalUrl());
            String host = url.getHost();
            InetAddress address = InetAddress.getByName(host);
            String ipAddress = address.getHostAddress();
            log.info("Resolved domain {} to IP {}", host, ipAddress);
            processAndSaveGeolocation(shortUrl, ipAddress, "Website Origin");
        } catch (Exception e) {
            log.error("Failed to resolve website location for {}", shortUrl.getOriginalUrl(), e);
        }
    }

    private void processAndSaveGeolocation(ShortUrl shortUrl, String ipAddress, String type) {
        try {
            String url = "http://ip-api.com/json/" + ipAddress;
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            if (response != null && "success".equals(response.get("status"))) {
                double lat = (double) response.get("lat");
                double lon = (double) response.get("lon");
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
                .build();
        clickRepository.save(click);
    }
}
