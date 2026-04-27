package com.example.urlshortener.repository;

import com.example.urlshortener.model.Click;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClickRepository extends JpaRepository<Click, Long> {
    List<Click> findByShortUrlId(Long urlId);
}
