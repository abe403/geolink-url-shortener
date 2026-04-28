import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe, BarChart3, Plus, Copy, Search, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import L from 'leaflet';

// Fix for default marker icons in React Leaflet
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Normalizes any URL-like string into a full https:// URL
function normalizeUrl(raw) {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return 'https://' + trimmed;
}

// Extracts just the hostname from any URL-like string
function getDomain(rawUrl) {
  if (!rawUrl) return '';
  try {
    return new URL(normalizeUrl(rawUrl)).hostname;
  } catch {
    return rawUrl;
  }
}

// Flies to a given [lat, lon] target whenever it changes
function MapUpdater({ analytics, flyTarget }) {
  const map = useMap();
  const prevLengthRef = useRef(0);

  // Fly when a manual flyTarget is set (link selection)
  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lon], 5, { animate: true, duration: 1.5 });
    }
  }, [flyTarget, map]);

  // Also fly when new analytics arrive (after shortening)
  useEffect(() => {
    const withLocation = analytics.filter(c => c.latitude != null && c.longitude != null);
    if (withLocation.length > 0 && withLocation.length !== prevLengthRef.current) {
      prevLengthRef.current = withLocation.length;
      const latest = withLocation[0];
      map.flyTo([latest.latitude, latest.longitude], 5, { animate: true, duration: 1.5 });
    }
  }, [analytics, map]);

  return null;
}

const API_BASE = 'http://localhost:8080/api/urls';

function App() {
  const [url, setUrl] = useState('');
  const [urls, setUrls] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lookupIp, setLookupIp] = useState('');
  const [urlError, setUrlError] = useState('');
  const [flyTarget, setFlyTarget] = useState(null);
  const [urlPage, setUrlPage] = useState(1);
  const PAGE_SIZE = 4;
  const pollingRef = useRef(null);

  // Load all saved URLs from the database on mount
  useEffect(() => {
    axios.get(`${API_BASE}`)
      .then(res => setUrls(res.data))
      .catch(err => console.error('Failed to load URLs', err));
  }, []);

  const handleShorten = async (e) => {
    e.preventDefault();
    setUrlError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a URL.');
      return;
    }

    const fullUrl = normalizeUrl(trimmed);
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/shorten`, fullUrl, {
        headers: { 'Content-Type': 'text/plain' }
      });

      const newEntry = res.data;
      setUrls(prev => [newEntry, ...prev]);
      setUrlPage(1); // jump to first page so the new link is visible
      setUrl('');
      setAnalytics([]);    // clear stale markers
      setSelectedUrl(newEntry);

      // Poll analytics for 10 seconds to catch the async geolocation result
      let attempts = 0;
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(async () => {
        attempts++;
        try {
          const aRes = await axios.get(`${API_BASE}/${newEntry.shortCode}/analytics`);
          if (aRes.data.length > 0) {
            setAnalytics(aRes.data);
            // Fly the camera to the first located waypoint
            const first = aRes.data.find(c => c.latitude != null && c.longitude != null);
            if (first) {
              setFlyTarget({ lat: first.latitude, lon: first.longitude, ts: Date.now() });
            }
            clearInterval(pollingRef.current);
          }
        } catch (_) { /* ignore */ }
        if (attempts >= 20) clearInterval(pollingRef.current); // stop after 10s
      }, 500);

    } catch (err) {
      console.error(err);
      setUrlError('Failed to shorten URL. Check the address and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load analytics when user manually selects a link
  const handleSelectUrl = async (item) => {
    setSelectedUrl(item);
    setAnalytics([]);
    try {
      const res = await axios.get(`${API_BASE}/${item.shortCode}/analytics`);
      const data = res.data;
      setAnalytics(data);
      // Fly camera to the first waypoint with coordinates
      const first = data.find(c => c.latitude != null && c.longitude != null);
      if (first) {
        setFlyTarget({ lat: first.latitude, lon: first.longitude, ts: Date.now() });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(`http://localhost:8080/${code}`);
  };

  const simulateClick = () => {
    if (!selectedUrl) return;
    window.open(`http://localhost:8080/${selectedUrl.shortCode}`, '_blank');
    setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/${selectedUrl.shortCode}/analytics`);
        setAnalytics(res.data);
      } catch (_) {}
    }, 2500);
  };

  const handleIpLookup = async () => {
    if (!lookupIp) return;
    const query = lookupIp.trim();
    try {
      // ip-api.com accepts both raw IPs and domain names natively
      const res = await axios.get(`http://ip-api.com/json/${encodeURIComponent(query)}`);
      if (res.data.status === 'success') {
        const mockClick = {
          id: Date.now(),
          city: res.data.city,
          country: res.data.country,
          isp: res.data.isp,
          ipAddress: res.data.query,   // ip-api always returns the resolved IP
          latitude: res.data.lat,
          longitude: res.data.lon,
          timestamp: new Date().toISOString()
        };
        setAnalytics(prev => [mockClick, ...prev]);
      } else {
        alert(`Could not resolve "${query}" — try a different IP or domain.`);
      }
    } catch (err) {
      console.error('IP lookup failed', err);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => () => clearInterval(pollingRef.current), []);

  // Filter for valid coordinates (not null and not exactly 0,0 which is often a failure default)
  const analyticsWithLocation = analytics.filter(c => 
    c.latitude != null && c.longitude != null && (c.latitude !== 0 || c.longitude !== 0)
  );
  
  const topRegion   = analyticsWithLocation[0]?.country    ?? (analytics[0]?.country || 'N/A');
  const latestCity  = analyticsWithLocation[0]?.city       ?? (analytics[0]?.city || 'N/A');
  const websiteIp   = analytics[0]?.ipAddress              ?? 'N/A';

  return (
    <div className="dashboard-container">
      <header>
        <div className="logo">
          <Globe size={28} />
          GEO.LINK
        </div>
        <div className="user-profile">
          <div className="glass-card" style={{ padding: '0.5rem 1rem', borderRadius: '2rem' }}>
            Analytics Dashboard
          </div>
        </div>
      </header>

      <main>
        <aside>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card"
          >
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={20} /> New Short URL
            </h3>

            {/* URL input — plain text so "www.reddit.com" works */}
            <form onSubmit={handleShorten} className="input-group">
              <input
                type="text"
                placeholder="https://example.com  or  www.reddit.com"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              />
              {urlError && (
                <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '-0.25rem' }}>{urlError}</p>
              )}
              <button type="submit" disabled={loading}>
                {loading ? 'Shortening...' : 'Shorten Link'}
              </button>
            </form>

            {/* Manual IP Lookup */}
            <div className="url-list" style={{ marginTop: '2rem' }}>
              <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>IP LOOKUP</h4>
              <div className="input-group" style={{ flexDirection: 'row' }}>
                <input
                  type="text"
                  placeholder="8.8.8.8 or reddit.com"
                  value={lookupIp}
                  onChange={(e) => setLookupIp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleIpLookup()}
                  style={{ flex: 1 }}
                />
                <button onClick={handleIpLookup} style={{ padding: '0.5rem 0.75rem' }}>
                  <Search size={18} />
                </button>
              </div>
            </div>

            {/* Recent Links with pagination */}
            <div className="url-list" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>RECENT LINKS</h4>
                {urls.length > PAGE_SIZE && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {urlPage} / {Math.ceil(urls.length / PAGE_SIZE)}
                  </span>
                )}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={urlPage}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                >
                  {urls.slice((urlPage - 1) * PAGE_SIZE, urlPage * PAGE_SIZE).map((item) => (
                    <div
                      key={item.id}
                      className={`url-item ${selectedUrl?.id === item.id ? 'active' : ''}`}
                      onClick={() => handleSelectUrl(item)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="short-url-link">/{item.shortCode}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(item.shortCode); }} className="icon-btn">
                          <Copy size={14} />
                        </button>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getDomain(item.originalUrl)}
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>

              {/* Pagination controls */}
              {urls.length > PAGE_SIZE && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', gap: '0.5rem' }}>
                  <button
                    onClick={() => setUrlPage(p => Math.max(1, p - 1))}
                    disabled={urlPage === 1}
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', opacity: urlPage === 1 ? 0.4 : 1, cursor: urlPage === 1 ? 'default' : 'pointer' }}
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setUrlPage(p => Math.min(Math.ceil(urls.length / PAGE_SIZE), p + 1))}
                    disabled={urlPage >= Math.ceil(urls.length / PAGE_SIZE)}
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', opacity: urlPage >= Math.ceil(urls.length / PAGE_SIZE) ? 0.4 : 1, cursor: urlPage >= Math.ceil(urls.length / PAGE_SIZE) ? 'default' : 'pointer' }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </aside>

        <section>
          <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem' }}>
                  {selectedUrl
                    ? `Analytics for ${getDomain(selectedUrl.originalUrl)}`
                    : 'Global Click Map'}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {analytics.length} total interactions recorded
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {selectedUrl && (
                  <button
                    onClick={simulateClick}
                    style={{ background: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Zap size={16} /> Test Link
                  </button>
                )}
                <BarChart3 />
              </div>
            </div>

            <div className="map-container">
              <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={true}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater analytics={analytics} flyTarget={flyTarget} />
                {analyticsWithLocation.map((click) => (
                  <Marker
                    key={click.id}
                    position={[click.latitude, click.longitude]}
                  >
                    <Popup>
                      <div style={{ color: '#333' }}>
                        <strong>{click.city}, {click.country}</strong><br />
                        ISP: {click.isp}<br />
                        IP: {click.ipAddress}<br />
                        Time: {new Date(click.timestamp).toLocaleString()}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top Region</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{topRegion}</div>
              </div>
              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Latest City</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{latestCity}</div>
              </div>
              <div className="glass-card" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Website IP</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{websiteIp}</div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
