package com.example.urlshortener.service;

import com.example.urlshortener.model.ShortUrl;
import com.example.urlshortener.repository.ClickRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit Tests — GeolocationService
 *
 * Tests IP-to-coordinate resolution and Click persistence logic
 * using mocked HTTP (RestTemplate) and repository dependencies.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("GeolocationService Unit Tests")
class GeolocationServiceTest {

    @Mock
    private ClickRepository clickRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private GeolocationService geolocationService;

    private ShortUrl buildShortUrl(String originalUrl) {
        return ShortUrl.builder()
                .id(1L)
                .shortCode("abc123")
                .originalUrl(originalUrl)
                .build();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildSuccessResponse(double lat, double lon) {
        return Map.of(
                "status", "success",
                "city", "San Jose",
                "country", "United States",
                "isp", "AS-13335 Cloudflare",
                "lat", lat,
                "lon", lon
        );
    }

    // ── recordClick ─────────────────────────────────────────────

    @Test
    @DisplayName("recordClick should save a Click entity when geolocation succeeds")
    void recordClick_shouldSaveClickOnSuccess() {
        ShortUrl url = buildShortUrl("https://www.example.com");
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenReturn(buildSuccessResponse(37.3387, -121.8853));

        geolocationService.recordClick(url, "1.1.1.1");

        verify(clickRepository, timeout(3000).times(1)).save(any());
    }

    @Test
    @DisplayName("recordClick should save a fallback Click when IP is local/unresolvable")
    void recordClick_shouldSaveFallbackForLocalIp() {
        ShortUrl url = buildShortUrl("https://www.example.com");
        // ip-api returns 'fail' for 127.0.0.1
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenReturn(Map.of("status", "fail"));

        geolocationService.recordClick(url, "127.0.0.1");

        // Fallback still saves a Click (without coordinates)
        verify(clickRepository, timeout(3000).atLeastOnce()).save(any());
    }

    @Test
    @DisplayName("recordClick should not throw when RestTemplate fails")
    void recordClick_shouldHandleRestTemplateException() {
        ShortUrl url = buildShortUrl("https://www.example.com");
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenThrow(new RuntimeException("Network error"));

        // Should not throw — error is caught internally
        assertThatCode(() -> geolocationService.recordClick(url, "1.1.1.1"))
                .doesNotThrowAnyException();
    }

    // ── recordWebsiteLocation ────────────────────────────────────

    @Test
    @DisplayName("recordWebsiteLocation should resolve domain to IP and save a Click")
    void recordWebsiteLocation_shouldResolveAndSave() {
        ShortUrl url = buildShortUrl("https://www.example.com");
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenReturn(buildSuccessResponse(37.3387, -121.8853));

        geolocationService.recordWebsiteLocation(url);

        verify(clickRepository, timeout(5000).times(1)).save(any());
    }

    @Test
    @DisplayName("recordWebsiteLocation should handle malformed URLs gracefully")
    void recordWebsiteLocation_shouldHandleMalformedUrl() {
        ShortUrl url = buildShortUrl("not-a-valid-url");

        // Should not throw — bad URL is caught internally
        assertThatCode(() -> geolocationService.recordWebsiteLocation(url))
                .doesNotThrowAnyException();

        // Repository should NOT be called since we can't resolve a host
        verify(clickRepository, after(2000).never()).save(any());
    }

    @Test
    @DisplayName("recordWebsiteLocation should label the ISP with '(Website Origin)'")
    void recordWebsiteLocation_shouldTagIspWithType() {
        ShortUrl url = buildShortUrl("https://www.example.com");
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
                .thenReturn(buildSuccessResponse(37.3387, -121.8853));

        geolocationService.recordWebsiteLocation(url);

        var captor = ArgumentCaptor.forClass(com.example.urlshortener.model.Click.class);
        verify(clickRepository, timeout(5000)).save(captor.capture());

        assertThat(captor.getValue().getIsp()).contains("Website Origin");
    }
}
