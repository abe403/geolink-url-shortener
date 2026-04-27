package com.example.urlshortener.service;

import com.example.urlshortener.model.ShortUrl;
import com.example.urlshortener.repository.ShortUrlRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit Tests — UrlShortenerService
 *
 * Tests the business logic in isolation using Mockito to mock
 * the repository layer. No Spring context is loaded (fast execution).
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UrlShortenerService Unit Tests")
class UrlShortenerServiceTest {

    @Mock
    private ShortUrlRepository shortUrlRepository;

    @InjectMocks
    private UrlShortenerService urlShortenerService;

    private static final String ORIGINAL_URL = "https://www.example.com";

    private void stubSuccessfulSave() {
        when(shortUrlRepository.existsByShortCode(anyString())).thenReturn(false);
        when(shortUrlRepository.save(any(ShortUrl.class))).thenAnswer(invocation -> {
            ShortUrl url = invocation.getArgument(0);
            url.setId(1L);
            return url;
        });
    }

    // ── URL Shortening ──────────────────────────────────────────

    @Test
    @DisplayName("shortenUrl should return a ShortUrl with a 6-character Base62 code")
    void shortenUrl_shouldReturnValidShortCode() {
        stubSuccessfulSave();
        ShortUrl result = urlShortenerService.shortenUrl(ORIGINAL_URL);

        assertThat(result).isNotNull();
        assertThat(result.getShortCode()).isNotBlank();
        assertThat(result.getShortCode()).hasSize(6);
        assertThat(result.getShortCode()).matches("[A-Za-z0-9]+");
    }

    @Test
    @DisplayName("shortenUrl should preserve the original URL exactly")
    void shortenUrl_shouldPreserveOriginalUrl() {
        stubSuccessfulSave();
        ShortUrl result = urlShortenerService.shortenUrl(ORIGINAL_URL);
        assertThat(result.getOriginalUrl()).isEqualTo(ORIGINAL_URL);
    }

    @Test
    @DisplayName("shortenUrl should call repository.save exactly once")
    void shortenUrl_shouldPersistEntity() {
        stubSuccessfulSave();
        urlShortenerService.shortenUrl(ORIGINAL_URL);
        verify(shortUrlRepository, times(1)).save(any(ShortUrl.class));
    }

    @Test
    @DisplayName("shortenUrl should regenerate code on collision")
    void shortenUrl_shouldHandleShortCodeCollision() {
        // First existsByShortCode call returns true (collision), second returns false
        when(shortUrlRepository.existsByShortCode(anyString()))
                .thenReturn(true)
                .thenReturn(false);
        when(shortUrlRepository.save(any(ShortUrl.class))).thenAnswer(invocation -> {
            ShortUrl url = invocation.getArgument(0);
            url.setId(1L);
            return url;
        });

        ShortUrl result = urlShortenerService.shortenUrl(ORIGINAL_URL);

        assertThat(result.getShortCode()).isNotBlank();
        verify(shortUrlRepository, atLeast(2)).existsByShortCode(anyString());
    }

    @Test
    @DisplayName("Different URLs should generate different short codes")
    void shortenUrl_shouldGenerateUniqueCodesForDifferentUrls() {
        stubSuccessfulSave();
        ShortUrl first = urlShortenerService.shortenUrl("https://www.reddit.com");
        ShortUrl second = urlShortenerService.shortenUrl("https://www.github.com");

        assertThat(first.getShortCode()).isNotEqualTo(second.getShortCode());
    }

    // ── URL Lookup ──────────────────────────────────────────────

    @Test
    @DisplayName("getByShortCode should return the correct ShortUrl")
    void getByShortCode_shouldReturnMatchingUrl() {
        ShortUrl expected = ShortUrl.builder()
                .id(42L)
                .shortCode("abc123")
                .originalUrl(ORIGINAL_URL)
                .build();

        when(shortUrlRepository.findByShortCode("abc123")).thenReturn(Optional.of(expected));

        ShortUrl result = urlShortenerService.getByShortCode("abc123");

        assertThat(result.getId()).isEqualTo(42L);
        assertThat(result.getOriginalUrl()).isEqualTo(ORIGINAL_URL);
    }

    @Test
    @DisplayName("getByShortCode should throw RuntimeException for unknown code")
    void getByShortCode_shouldThrowForUnknownCode() {
        when(shortUrlRepository.findByShortCode("XXXXXX")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> urlShortenerService.getByShortCode("XXXXXX"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("URL not found");
    }

    // ── Get All URLs ─────────────────────────────────────────────

    @Test
    @DisplayName("getAllUrls should return all persisted URLs ordered newest first")
    void getAllUrls_shouldReturnAllUrls() {
        List<ShortUrl> mockList = List.of(
                ShortUrl.builder().id(2L).shortCode("bbb222").originalUrl("https://b.com").build(),
                ShortUrl.builder().id(1L).shortCode("aaa111").originalUrl("https://a.com").build()
        );
        when(shortUrlRepository.findAllByOrderByCreatedAtDesc()).thenReturn(mockList);

        List<ShortUrl> result = urlShortenerService.getAllUrls();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo(2L); // Newest first
    }

    @Test
    @DisplayName("getAllUrls should return empty list when no URLs exist")
    void getAllUrls_shouldReturnEmptyList() {
        when(shortUrlRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());

        List<ShortUrl> result = urlShortenerService.getAllUrls();

        assertThat(result).isEmpty();
    }
}
