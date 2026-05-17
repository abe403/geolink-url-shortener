package com.example.urlshortener.repository;

import com.example.urlshortener.model.Click;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ClickRepository extends JpaRepository<Click, Long> {
    List<Click> findByShortUrlId(Long urlId);

    // PostgresML XGBoost Anomaly Detection Integration
    // Evaluates telemetry features directly in the DB to filter bot traffic
    @Query(nativeQuery = true, value = "SELECT pgml.predict('bot_detection_model', ARRAY[length(:ipAddress), length(:isp)]) > 0.8")
    Boolean isBotTraffic(@Param("ipAddress") String ipAddress, @Param("isp") String isp);
}
