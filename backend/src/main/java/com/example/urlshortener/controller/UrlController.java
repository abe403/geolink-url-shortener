package com.example.urlshortener.controller;

import com.example.urlshortener.dto.ClickDto;
import com.example.urlshortener.model.Click;
import com.example.urlshortener.model.ShortUrl;
import com.example.urlshortener.repository.ClickRepository;
import com.example.urlshortener.service.GeolocationService;
import com.example.urlshortener.service.UrlShortenerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/urls")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class UrlController {
    private final UrlShortenerService urlShortenerService;
    private final ClickRepository clickRepository;
    private final GeolocationService geolocationService;

    @PostMapping("/shorten")
    public ResponseEntity<ShortUrl> shortenUrl(@RequestBody String originalUrl) {
        ShortUrl url = urlShortenerService.shortenUrl(originalUrl);
        // Record the destination website's physical location (async)
        geolocationService.recordWebsiteLocation(url);
        return ResponseEntity.ok(url);
    }

    @GetMapping
    public ResponseEntity<List<ShortUrl>> getAllUrls() {
        List<ShortUrl> urls = urlShortenerService.getAllUrls();
        return ResponseEntity.ok(urls);
    }

    @GetMapping("/{shortCode}")
    public ResponseEntity<ShortUrl> getUrl(@PathVariable String shortCode) {
        return ResponseEntity.ok(urlShortenerService.getByShortCode(shortCode));
    }

    @GetMapping("/{shortCode}/analytics")
    public ResponseEntity<List<ClickDto>> getAnalytics(@PathVariable String shortCode) {
        ShortUrl url = urlShortenerService.getByShortCode(shortCode);
        List<Click> clicks = clickRepository.findByShortUrlId(url.getId());

        List<ClickDto> dtos = clicks.stream().map(c -> {
            ClickDto.ClickDtoBuilder b = ClickDto.builder()
                    .id(c.getId())
                    .ipAddress(c.getIpAddress())
                    .city(c.getCity())
                    .country(c.getCountry())
                    .isp(c.getIsp())
                    .timestamp(c.getTimestamp() != null ? c.getTimestamp().toString() : null);

            if (c.getLocation() != null) {
                // JTS Point: x=longitude, y=latitude
                b.longitude(c.getLocation().getX());
                b.latitude(c.getLocation().getY());
            }

            return b.build();
        }).collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }
}
