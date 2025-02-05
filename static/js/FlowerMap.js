class FlowerMap {
    constructor() {
      this.map = null;
      this.markerCluster = null;
      this.dateRange = { from: null, to: null };
      this.currentMarkers = [];
      this.statistics = new FlowerStatistics();
      this.pikaday = null;
      this.errorDiv = null;
      this.sourceFilters = {
        tiuli: true,
        merged: true
      };
  
      // Initialize the map
      this.initializeMap();
      this.initializeDatePicker();
      this.initializeSourceFilter();
      flowerMapUtils.tabUtils.initialize();
  
      // Load initial data
      this.loadData();
    }
  
    initializeMap() {
      flowerMapUtils.logger.info('Initializing map (Leaflet version)');
  
      // Function to get the API key from a meta tag
      function getApiKeyFromMetaTag() {
        const apiKey = document.querySelector('meta[name="tilemap-api-key"]')?.content;
        if (!apiKey) {
          flowerMapUtils.logger.warn('API key not found in meta tag.');
        }
        return apiKey;
      }
  
      const mapTilerApiKey = getApiKeyFromMetaTag();
  
      if (!mapTilerApiKey) {
        flowerMapUtils.logger.warn('No API key loaded, map will not function correctly.');
        return; // Don't initialize the map if the API key is missing
      }
  
      this.map = L.map('map').setView([31.7683, 35.2137], 8); // Initial center and zoom
  
      L.tileLayer('https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=' + mapTilerApiKey, {
        attribution: '<a href="https://www.maptiler.com/copyright/" target="_blank">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'
      }).addTo(this.map);
  
      this.markerCluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
      });
  
      this.markerCluster.addTo(this.map); // Use addTo on the markerCluster, not addLayer on the map
  
      this.displayLastUpdateDate();
    }
  
    async displayLastUpdateDate() {
      try {
        const [tiuliData, mergedData] = await Promise.all([
          fetch('./tiuli_reports.json').then(response => response.json()),
          fetch('./merged_reports.json').then(response => response.json())
        ]);
  
        const tiuliDates = tiuliData.reports.map(report => this.parseDate(report.date));
        const mergedDates = mergedData.reports.map(report => this.parseDate(report.date));
  
  
        const allDates = [...tiuliDates, ...mergedDates];
  
        const latestDate = new Date(Math.max.apply(null, allDates));
        const formattedDate = flowerMapUtils.dateUtils.formatDate(latestDate);
        document.getElementById('last-update').innerText = `Last update: ${formattedDate}`;
  
      } catch (error) {
        console.error('Error fetching last update dates:', error);
        this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
      }
    }
    parseDate(dateString) {
      if (typeof dateString === 'string' && dateString.includes('/')) {
        const [day, month, year] = dateString.split('/');
        return new Date(`${year}-${month}-${day}`);
      }
      return new Date(dateString);
    }
  
    initializeDatePicker() {
      const datePickerButton = document.getElementById('datePickerButton');
      const calendar = document.getElementById('calendar');
      const clearDates = document.getElementById('clearDates');
  
      this.pikaday = new Pikaday({
        field: datePickerButton,
        container: calendar,
        bound: false,
        format: 'DD/MM/YYYY',
        i18n: {
          previousMonth: 'חודש קודם',
          nextMonth: 'חודש הבא',
          months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
          weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
          weekdaysShort: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
        },
        onSelect: (date) => {
          this.handleDateSelect(date);
        }
      });
  
      clearDates.addEventListener('click', () => this.clearDateFilter());
  
      datePickerButton.addEventListener('click', () => {
        calendar.classList.toggle('hidden');
      });
  
    }
  
    async loadData() {
      try {
        flowerMapUtils.logger.info('Loading flower reports');
  
        const [tiuliResponse, mergedResponse] = await Promise.all([
          fetch('./tiuli_reports.json'),
          fetch('./merged_reports.json')
        ]);
  
        if (!tiuliResponse.ok) {
          throw new Error(`HTTP error! status: ${tiuliResponse.status} for tiuli_reports.json`);
        }
        if (!mergedResponse.ok) {
          throw new Error(`HTTP error! status: ${mergedResponse.status} for merged_reports.json`);
        }
  
  
        const tiuliData = await tiuliResponse.json();
        const mergedData = await mergedResponse.json();
  
  
        const tiuliReports = tiuliData.reports.map(report => ({ ...report, source: 'tiuli' }));
        const mergedReports = mergedData.reports.map(report => ({ ...report, source: 'merged' }));
  
        const allReports = [...tiuliReports, ...mergedReports];
  
  
        this.processData(allReports);
        this.statistics.updateStatistics(allReports, this.dateRange, this.sourceFilters);
        flowerMapUtils.logger.info('Data loaded successfully', { count: allReports.length });
      } catch (error) {
        flowerMapUtils.logger.error('Failed to load data', error);
        this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
      }
    }
  
  
    processData(reports) {
      this.markerCluster.clearLayers();
      this.currentMarkers = [];
      const filteredReports = reports.filter(report => {
        try {
          let date;
          if (typeof report.date === 'string' && report.date.includes('/')) {
            const [day, month, year] = report.date.split('/');
            date = new Date(`${year}-${month}-${day}`);
          } else if (typeof report.date === 'string' && report.date.includes('-')) {
            const [year, month, day] = report.date.split('-');
            date = new Date(`${year}-${month}-${day}`);
          }
          else {
            date = new Date(report.date);
          }
          if (isNaN(date.getTime())) {
            flowerMapUtils.logger.warn('Invalid date in report', { report });
            return false;
          }
          return (
            flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange) &&
            this.sourceFilters[report.source]
          );
        } catch (error) {
          flowerMapUtils.logger.error('Error processing report date', { report, error });
          return false;
        }
      });
  
      filteredReports.forEach(report => {
        if (!report.geocoded_locations) {
          flowerMapUtils.logger.warn('skipping report due to missing geocoded_locations', { report });
          return;
        }
        if (Array.isArray(report.locations)) {
          for (const location of report.locations) {
            if (typeof location === 'object' && location !== null && location.location_name && report.geocoded_locations[location.location_name]) {
              try {
                const locationData = report.geocoded_locations[location.location_name];
                const marker = this.createMarker(report, locationData, location.location_name);
                this.currentMarkers.push(marker);
                this.markerCluster.addLayer(marker);
              } catch (error) {
                flowerMapUtils.logger.error('Error creating marker', { report, location, error });
              }
            } else {
              flowerMapUtils.logger.warn('skipping invalid location:', { location, report });
            }
          }
        } else {
          flowerMapUtils.logger.warn('Report locations is not an array', { report });
        }
  
      });
  
      flowerMapUtils.logger.info('Markers updated', {
        total: reports.length,
        filtered: filteredReports.length
      });
    }
    createMarker(report, locationData, locationName) {
  
      if (!locationData || typeof locationData !== 'object' || locationData === null) {
        flowerMapUtils.logger.error('Invalid locationData passed to createMarker', { locationData, report, locationName });
        return null;
      }
      if (!report) {
        flowerMapUtils.logger.error('Invalid report passed to createMarker', { report, locationData, locationName });
        return null;
      }
      const marker = L.marker([locationData.latitude, locationData.longitude]);
      const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
  
      const popupContent = `
              <div class="popup-content">
                  <h3 class="popup-title">${report.locations.flatMap(location => location.flowers).join(", ")}</h3>
                  <p><strong>מיקום:</strong> ${locationName}</p>
                  <p><strong>תאריך:</strong> ${formattedDate}</p>
                  <p><strong>מקור:</strong> ${report.source === 'tiuli' ? 'טיולי' : 'מיזוג'}</p>
                  <p><strong>דיווח מקורי:</strong> ${report.original_text}</p>
                  <button onclick="flowerMapUtils.shareUtils.shareLocation(${locationData.latitude}, ${locationData.longitude}, '${report.locations.flatMap(location => location.flowers).join(", ")}')"
        class="share-button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                          <polyline points="16 6 12 2 8 6"></polyline>
                          <line x1="12" y1="2" x2="12" y2="15"></line>
                      </svg>
                      שתף מיקום
                  </button>
              </div>
          `;
  
      marker.bindPopup(popupContent);
      return marker;
    }
  
  
    handleDateSelect(date) {
      const selectedDate = new Date(date);
      if (!this.dateRange.from || this.dateRange.to) {
        // Start new range
        this.dateRange = {
          from: selectedDate,
          to: null
        };
        document.getElementById('selectedDateRange').textContent =
          flowerMapUtils.dateUtils.formatDate(date);
      } else {
        // Complete the range
        const currentFromDate = new Date(this.dateRange.from);
        if (flowerMapUtils.dateUtils.compareDates(selectedDate, currentFromDate) < 0) {
          this.dateRange = {
            from: selectedDate,
            to: currentFromDate,
          };
        }
        else if (flowerMapUtils.dateUtils.compareDates(selectedDate, currentFromDate) === 0) {
          this.dateRange.to = selectedDate
        } else {
          this.dateRange.to = selectedDate;
        }
  
        document.getElementById('selectedDateRange').textContent =
          `${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} - ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;
  
        document.getElementById('calendar').classList.add('hidden');
        this.loadData();
      }
    }
  
    clearDateFilter() {
      this.dateRange = { from: null, to: null };
      document.getElementById('selectedDateRange').textContent = 'בחר תאריכים';
      this.loadData();
      flowerMapUtils.logger.info('Date filter cleared');
    }
  
    showError(message) {
      if (this.errorDiv) {
        this.errorDiv.remove();
      }
      this.errorDiv = document.createElement('div');
      this.errorDiv.className = 'error-message';
      this.errorDiv.textContent = message;
      document.querySelector('.card-header').appendChild(this.errorDiv);
  
      setTimeout(() => {
        if (this.errorDiv) {
          this.errorDiv.remove();
        }
      }, 5000);
    }
    initializeSourceFilter() {
      const tiuliCheckbox = document.getElementById('tiuli-filter');
      const mergedCheckbox = document.getElementById('merged-filter');
  
      tiuliCheckbox.addEventListener('change', () => this.handleSourceFilterChange('tiuli', tiuliCheckbox.checked));
      mergedCheckbox.addEventListener('change', () => this.handleSourceFilterChange('merged', mergedCheckbox.checked));
    }
  
    handleSourceFilterChange(source, isChecked) {
      this.sourceFilters[source] = isChecked;
      this.loadData();
    }
  };
  
  // Initialize the map when the DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    // Check if FlowerStatistics is defined before using it
    if (typeof FlowerStatistics !== 'undefined') {
      if (window.flowerMap) {
        // Add a cleanup method to FlowerMap if needed, or simply clear existing data
        window.flowerMap = null; // Or window.flowerMap.clearData() if you add such a method
      }
      window.flowerMap = new FlowerMap();
    } else {
      console.error('FlowerStatistics is not defined. Ensure it is loaded before FlowerMap.');
    }
  });