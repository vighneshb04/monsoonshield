/**
 * Weather Service - OpenWeatherMap + Mock fallback
 */
const axios = require('axios');
const { query } = require('../config/db');

// Mumbai flood-prone zones approximate coordinates
const ZONE_COORDS = {
  'Kurla':        { lat: 19.0728, lon: 72.8826 },
  'Dharavi':      { lat: 19.0400, lon: 72.8543 },
  'Sion':         { lat: 19.0434, lon: 72.8614 },
  'Andheri East': { lat: 19.1136, lon: 72.8697 },
  'Bhandup':      { lat: 19.1474, lon: 72.9393 },
  'Vikhroli':     { lat: 19.1059, lon: 72.9312 },
  'Ghatkopar':    { lat: 19.0860, lon: 72.9081 },
  'Chembur':      { lat: 19.0620, lon: 72.8990 },
};

class WeatherService {
  /**
   * Get latest weather for a zone
   */
  async getLatestWeather(zoneId) {
    const result = await query(
      'SELECT * FROM weather_data WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1',
      [zoneId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // If no data, create mock data
    return this.createMockWeather(zoneId, false);
  }

  /**
   * Refresh weather for all zones
   */
  async refreshAllZones() {
    const zones = await query('SELECT * FROM zones WHERE is_active = true');
    for (const zone of zones.rows) {
      await this.refreshZoneWeather(zone);
    }
  }

  /**
   * Refresh weather for a single zone
   */
  async refreshZoneWeather(zone) {
    try {
      let weatherData;

      if (process.env.OPENWEATHER_MOCK === 'true' || !process.env.OPENWEATHER_API_KEY) {
        weatherData = this.generateMockWeatherData(zone.name);
      } else {
        weatherData = await this.fetchFromOpenWeather(zone);
      }

      const result = await query(`
        INSERT INTO weather_data (zone_id, rainfall_mm, rainfall_1h, rainfall_24h, wind_speed, humidity, visibility, flood_alert, data_source, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        zone.id,
        weatherData.rainfall_3h,
        weatherData.rainfall_1h,
        weatherData.rainfall_24h,
        weatherData.wind_speed,
        weatherData.humidity,
        weatherData.visibility,
        weatherData.rainfall_3h >= 60,
        weatherData.source,
        JSON.stringify(weatherData.raw)
      ]);

      return result.rows[0];
    } catch (err) {
      console.error(`[WEATHER] Failed to refresh zone ${zone.name}:`, err.message);
    }
  }

  /**
   * Fetch real data from OpenWeatherMap
   */
  async fetchFromOpenWeather(zone) {
    const coords = ZONE_COORDS[zone.name] || { lat: 19.0760, lon: 72.8777 };
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`;

    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    return {
      rainfall_3h: data.rain ? (data.rain['3h'] || data.rain['1h'] || 0) : 0,
      rainfall_1h: data.rain ? (data.rain['1h'] || 0) : 0,
      rainfall_24h: data.rain ? (data.rain['3h'] * 8 || 0) : 0, // estimate
      wind_speed: (data.wind?.speed || 0) * 3.6, // m/s to km/h
      humidity: data.main?.humidity || 0,
      visibility: (data.visibility || 10000) / 1000,
      source: 'openweather',
      raw: data
    };
  }

  /**
   * Generate mock weather data (realistic Mumbai monsoon patterns)
   */
  generateMockWeatherData(zoneName) {
    const isMonsoonSeason = [6, 7, 8, 9].includes(new Date().getMonth() + 1);
    const highRiskZones = ['Kurla', 'Dharavi', 'Sion'];
    const isHighRisk = highRiskZones.includes(zoneName);

    // Simulate occasional flood events
    const isFloodEvent = Math.random() < (isMonsoonSeason ? 0.15 : 0.02);

    const rainfall_3h = isFloodEvent
      ? 60 + Math.random() * 80  // 60-140mm during flood
      : Math.random() * 30 * (isHighRisk ? 1.3 : 1.0);

    return {
      rainfall_3h: Math.round(rainfall_3h * 10) / 10,
      rainfall_1h: Math.round(rainfall_3h / 3 * 10) / 10,
      rainfall_24h: Math.round(rainfall_3h * 3 * 10) / 10,
      wind_speed: 10 + Math.random() * 40,
      humidity: 70 + Math.random() * 25,
      visibility: isFloodEvent ? 1 + Math.random() * 3 : 5 + Math.random() * 10,
      source: 'mock',
      raw: { simulated: true, zone: zoneName }
    };
  }

  async createMockWeather(zoneId, floodEvent = false) {
    const zoneResult = await query('SELECT name FROM zones WHERE id = $1', [zoneId]);
    const zoneName = zoneResult.rows[0]?.name || 'Unknown';
    const mockData = this.generateMockWeatherData(zoneName);

    if (floodEvent) mockData.rainfall_3h = 75; // Force flood event

    const result = await query(`
      INSERT INTO weather_data (zone_id, rainfall_mm, rainfall_1h, rainfall_24h, flood_alert, data_source)
      VALUES ($1, $2, $3, $4, $5, 'mock') RETURNING *
    `, [zoneId, mockData.rainfall_3h, mockData.rainfall_1h, mockData.rainfall_24h, mockData.rainfall_3h >= 60]);

    return result.rows[0];
  }

  /**
   * Simulate a flood event for demo purposes
   */
  async simulateFloodEvent(zoneId) {
    return this.createMockWeather(zoneId, true);
  }
}

module.exports = new WeatherService();
