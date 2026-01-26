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
        this.allReports = [];

        // Set development mode (true for development, false for production)
        this.IS_DEVELOPMENT = true;

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

        this.map = L.map('map').setView([31.7683, 35.2137], 8);

        // Stamen Terrain tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.markerCluster);
    }

    parseDate(dateString){
        if(typeof dateString === 'string' && dateString.includes('/')){
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
            const rawReports = ALL_REPORTS;
            this.allReports = this.flattenReports(rawReports);
            this.processData();
            this.statistics.updateStatistics(this.allReports, this.dateRange, this.sourceFilters);
            flowerMapUtils.logger.info('Data loaded successfully', { count: this.allReports.length });
        } catch (error) {
            flowerMapUtils.logger.error('Failed to load data', error);
            this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
        }
    }

    flattenReports(rawReports) {
        const flatData = [];
        rawReports.forEach(report => {
            const source = report.source_file ? 'tiuli' : 'merged';
            const commonData = {
                title: report.title,
                flowers: report.flowers || [],
                date: report.date,
                description: report.description ? (Array.isArray(report.description) ? report.description.join('\n') : report.description) : '',
                source_file: report.source_file,
                source: source,
            };

            if (report.geocoded_locations) {
                for (const location in report.geocoded_locations) {
                    const coords_data = report.geocoded_locations[location];
                    if (coords_data && coords_data.latitude != null && coords_data.longitude != null) {
                        flatData.push({
                            ...commonData,
                            lat: coords_data.latitude,
                            lon: coords_data.longitude,
                        });
                    }
                }
            }

            if (report.coordinates) {
                report.coordinates.forEach(c => {
                    if (c && c.lat != null && c.lon != null) {
                        flatData.push({
                            ...commonData,
                            lat: c.lat,
                            lon: c.lon,
                        });
                    }
                });
            }
        });
        return flatData;
    }

    processData() {
        this.markerCluster.clearLayers();
        this.currentMarkers = [];
        const filteredReports = this.allReports.filter(report => {
            try {
                let date;
                if (typeof report.date === 'string' && report.date.includes('/')) {
                    const [day, month, year] = report.date.split('/');
                    date = new Date(`${year}-${month}-${day}`);
                } else if (typeof report.date === 'string' && report.date.includes('-')) {
                    const [year, month, day] = report.date.split('-');
                    date = new Date(`${year}-${month}-${day}`);
                } else {
                    date = new Date(report.date);
                }
                if (isNaN(date.getTime())) {
                    flowerMapUtils.logger.warn('Invalid date in report', { report });
                    return false;
                }

                const source = report.source;
                return (
                    flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange) &&
                    this.sourceFilters[source]
                );
            } catch (error) {
                flowerMapUtils.logger.error('Error processing report date', { report, error });
                return false;
            }
        });

        filteredReports.forEach(report => {
            const marker = this.createMarker(report);
            if (marker) {
                this.currentMarkers.push(marker);
                this.markerCluster.addLayer(marker);
            }
        });

        flowerMapUtils.logger.info('Markers updated', {
            total: this.allReports.length,
            filtered: filteredReports.length
        });
    }
    createMarker(report) {
        if (report.lat === null || report.lon === null) {
            return null;
        }
        const marker = L.marker([report.lat, report.lon]);
        const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
        const source = report.source;
        const flowersStr = Array.isArray(report.flowers) ? report.flowers.join(', ') : '';

        const popupContent = `
            <div class="popup-content">
                <h3 class="popup-title">${flowersStr}</h3>
                <p><strong>מיקום:</strong> ${report.title}</p>
                <p><strong>תאריך:</strong> ${formattedDate}</p>
                <p><strong>מקור:</strong> ${source}</p>
                <p><strong>דיווח מקורי:</strong> ${report.description}</p>
                <button onclick="flowerMapUtils.shareUtils.shareLocation(${report.lat}, ${report.lon}, '${flowersStr.replace(/'/g, "\\'")}')"
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
        }
        this.processData();
    }

    clearDateFilter() {
        this.dateRange = { from: null, to: null };
        document.getElementById('selectedDateRange').textContent = 'בחר תאריכים';
        this.processData();
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
            if(this.errorDiv){
                this.errorDiv.remove();
           }
         }, 5000);
     }
     initializeSourceFilter() {
        const tiuliCheckbox = document.getElementById('tiuli-filter');
        const mergedCheckbox = document.getElementById('merged-filter');

        if (tiuliCheckbox) {
            tiuliCheckbox.addEventListener('change', () => this.handleSourceFilterChange('tiuli', tiuliCheckbox.checked));
        } else {
            console.warn('tiuliCheckbox not found');
        }

        if (mergedCheckbox) {
            mergedCheckbox.addEventListener('change', () => this.handleSourceFilterChange('merged', mergedCheckbox.checked));
        } else {
            console.warn('mergedCheckbox not found');
        }
    }

    handleSourceFilterChange(source, isChecked) {
        this.sourceFilters[source] = isChecked;
        this.processData();
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
