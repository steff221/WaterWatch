/**
 * WaterWatch API Client
 * Communicates with backend /api/alerts and /api/reports endpoints
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

async function parseErrorResponse(response) {
  let message = `HTTP ${response.status}`;
  try {
    const data = await response.json();
    if (data && typeof data.error === 'string' && data.error.trim()) {
      message = data.error;
    } else if (data && typeof data.message === 'string' && data.message.trim()) {
      message = data.message;
    }
  } catch (e) {
    // Ignore JSON parse errors and keep status-based message.
  }
  return message;
}

class WaterWatchApi {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get alert for a specific river station
   * @param {string} stationId - River station ID (e.g., "vardar_vs")
   * @param {object} options - Optional request params (date, days_back, etc.)
   * @returns {Promise<object>} Alert JSON
   */
  async getStationAlert(stationId, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/api/alerts/station/${stationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch alert for ${stationId}:`, error);
      throw error;
    }
  }

  /**
   * List available Sentinel-2 products for a station
   * @param {string} stationId - River station ID
   * @param {number} daysBack - Search days back (default 7)
   * @param {number} maxCloudCover - Max cloud % (default 80)
   * @returns {Promise<object>} Product list with metadata
   */
  async getCatalogSentinel2(stationId, daysBack = 7, maxCloudCover = 80) {
    const query = new URLSearchParams({
      days_back: daysBack,
      max_cloud_cover: maxCloudCover,
    });

    const response = await fetch(
      `${this.baseUrl}/api/catalog/sentinel2/${stationId}?${query}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return await response.json();
  }

  /**
   * List available Sentinel-1 products for a station
   * @param {string} stationId - River station ID
   * @param {number} daysBack - Search days back (default 7)
   * @returns {Promise<object>} Product list with metadata
   */
  async getCatalogSentinel1(stationId, daysBack = 7) {
    const query = new URLSearchParams({ days_back: daysBack });

    const response = await fetch(
      `${this.baseUrl}/api/catalog/sentinel1/${stationId}?${query}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return await response.json();
  }

  /**
   * Submit a citizen report
   * @param {object} report - Report object
   * @param {string} report.station_id - Station ID
   * @param {number} report.latitude - Report latitude
   * @param {number} report.longitude - Report longitude
   * @param {string} report.observation_type - "photo", "voice", or "description"
   * @param {string} report.message - Report text
   * @param {boolean} report.confirmed - Optional confirmation flag
   * @returns {Promise<object>} Report submission response
   */
  async submitCitizenReport(report) {
    const response = await fetch(`${this.baseUrl}/api/reports/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get citizen reports for a station
   * @param {string} stationId - River station ID
   * @returns {Promise<object>} Reports list
   */
  async getStationReports(stationId) {
    const response = await fetch(`${this.baseUrl}/api/reports/station/${stationId}`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  /**
   * List available river stations
   * @returns {Promise<object>} Stations with metadata
   */
  async listStations() {
    const response = await fetch(`${this.baseUrl}/api/stations`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  /**
   * Health check
   * @returns {Promise<object>} Status info
   */
  async health() {
    const response = await fetch(`${this.baseUrl}/api/health`);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }

  /**
   * Copernicus authentication status
   * @returns {Promise<object>} Auth state details
   */
  async getAuthStatus() {
    const response = await fetch(`${this.baseUrl}/api/auth/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  }
}

export default WaterWatchApi;
