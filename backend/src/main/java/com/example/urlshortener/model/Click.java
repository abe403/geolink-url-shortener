package com.example.urlshortener.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.locationtech.jts.geom.Point;
import java.time.LocalDateTime;

@Entity
@Table(name = "clicks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Click {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "url_id", nullable = false)
    private ShortUrl shortUrl;

    private String ipAddress;
    private String city;
    private String country;
    private String isp;

    @Column(columnDefinition = "geometry(Point, 4326)")
    private Point location;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onPersist() {
        timestamp = LocalDateTime.now();
    }
}
