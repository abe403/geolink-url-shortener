package com.example.urlshortener.controller;

import com.example.urlshortener.model.ShortUrl;
import com.example.urlshortener.service.GeolocationService;
import com.example.urlshortener.service.UrlShortenerService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.servlet.view.RedirectView;

@Controller
@RequiredArgsConstructor
public class RedirectController {
    private final UrlShortenerService urlShortenerService;
    private final GeolocationService geolocationService;

    @GetMapping("/{shortCode}")
    public RedirectView redirect(@PathVariable String shortCode, HttpServletRequest request) {
        ShortUrl shortUrl = urlShortenerService.getByShortCode(shortCode);
        
        // Extract IP (handling potential proxies)
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }

        // Record click asynchronously
        geolocationService.recordClick(shortUrl, ip);

        return new RedirectView(shortUrl.getOriginalUrl());
    }
}
