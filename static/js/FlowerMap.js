const flowerMapUtils = {
    dateUtils: {
        formatDate(dateString, locale = 'en-HE') {
            try {
                if (!dateString || dateString.trim() === '') {
                    return 'Invalid date';
                }

                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                  throw new Error('Invalid date');
                }
                  
                return date.toLocaleDateString(locale, {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
            } catch (error) {
                flowerMapUtils.logger.error('Error formatting date:', error);
                return 'Invalid date';
            }
        },

        isDateInRange(dateString, dateRange) {
            if (!dateRange.from && !dateRange.to) return true;

            try {
                const date = new Date(dateString);
                if (isNaN(date.getTime())) {
                    flowerMapUtils.logger.warn('Invalid date string passed to isDateInRange', { dateString });
                    return false;
                }
                date.setHours(0, 0, 0, 0);  // Normalize time to start of day

                if (dateRange.from) {
                    const fromDate = new Date(dateRange.from);
                     if (isNaN(fromDate.getTime())) {
                        flowerMapUtils.logger.error('Invalid fromDate in dateRange', { dateRange });
                        return false;
                    }
                    fromDate.setHours(0, 0, 0, 0);
                    if (date < fromDate) return false;
                }

                if (dateRange.to) {
                    const toDate = new Date(dateRange.to);
                    if (isNaN(toDate.getTime())) {
                        flowerMapUtils.logger.error('Invalid toDate in dateRange', { dateRange });
                        return false;
                    }

                    toDate.setHours(23, 59, 59, 999);  // End of day
                    if (date > toDate) return false;
                }

                return true;
            } catch (error) {
                flowerMapUtils.logger.error('Error in isDateInRange:', error);
                return false;
            }
        },

        compareDates(date1, date2) {
             try {
                const d1 = new Date(date1);
                const d2 = new Date(date2);

                 if (isNaN(d1.getTime())) {
                    flowerMapUtils.logger.warn('Invalid date1 passed to compareDates', { date1 });
                    return NaN; // Or throw an error, depending on desired behavior
                }

                 if (isNaN(d2.getTime())) {
                    flowerMapUtils.logger.warn('Invalid date2 passed to compareDates', { date2 });
                    return NaN; // Or throw an error, depending on desired behavior
                }
                d1.setHours(0, 0, 0, 0);
                d2.setHours(0, 0, 0, 0);
                return d1.getTime() - d2.getTime();
            } catch (error) {
                flowerMapUtils.logger.error('Error in compareDates:', error);
                return NaN; // Or throw, depending on your needs
            }
        }
    },
    logger: {
        info: (message, data) => console.log(message, data || ''),
        error: (message, error) => console.error(message, error),
        warn: (message, data) => console.warn(message, data || '')
    },
    tabUtils: {
        initialize: () => {
            // Tab initialization logic here
        }
    },
    shareUtils: {
        shareLocation: (lat, lon, flowers) => {
            // Share location logic here
        }
    }
};

class FlowerMap {
    constructor() {
        this.map = null;
        this.markerCluster = null;
        this.dateRange = { from: null, to: null };
        this.currentMarkers = [];
        this.statistics = new FlowerStatistics();
        this.pikaday = null;
        this.errorDiv = null;

        // Initialize the map
        this.initializeMap();
        this.initializeDatePicker();
        flowerMapUtils.tabUtils.initialize();

        // Load initial data
        this.loadData();
    }

    initializeMap() {
        flowerMapUtils.logger.info('Initializing map');

        this.map = L.map('map').setView([31.7683, 35.2137], 8);

        var customStyledLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: 'Map data: © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            className: 'openstreetmap'
        });
        customStyledLayer.addTo(this.map);

        this.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.markerCluster);

        this.displayLastUpdateDate();
    }

    displayLastUpdateDate() {
        fetch('./static/reports.json')
            .then(response => response.json())
            .then(data => {
                const dates = data.map(report => new Date(report.date));
                const latestDate = new Date(Math.max.apply(null, dates));
                const formattedDate = flowerMapUtils.dateUtils.formatDate(latestDate);
                document.getElementById('last-update').innerText = `Last update: ${formattedDate}`;
            })
            .catch(error => {
                console.error('Error fetching the last update date:', error);
            });
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

        document.addEventListener('click', (e) => {
            if (!calendar.contains(e.target) && e.target !== datePickerButton) {
                calendar.classList.add('hidden');
            }
        });
    }

    async loadData() {
        try {
            flowerMapUtils.logger.info('Loading flower reports');
            const response = await fetch('./static/reports.json');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.processData(data);
            this.statistics.updateStatistics(data, this.dateRange);

            flowerMapUtils.logger.info('Data loaded successfully', { count: data.length });
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
                const date = new Date(report.date);
                if (isNaN(date.getTime())) {
                    flowerMapUtils.logger.warn('Invalid date in report', { report });
                    return false;
                }
                return flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange);
            } catch (error) {
                flowerMapUtils.logger.error('Error processing report date', { report, error });
                return false;
            }
        });

        filteredReports.forEach(report => {
            for (const locationName in report.geocoded_locations) {
                if (report.geocoded_locations.hasOwnProperty(locationName)) {
                    const locationData = report.geocoded_locations[locationName];
                    try {
                        const marker = this.createMarker(report, locationData, locationName);
                        this.currentMarkers.push(marker);
                        this.markerCluster.addLayer(marker);
                    } catch (error) {
                        flowerMapUtils.logger.error('Error creating marker', { report, locationName, error });
                    }
                }
            }
        });

        flowerMapUtils.logger.info('Markers updated', {
            total: reports.length,
            filtered: filteredReports.length
        });
    }

    createMarker(report, locationData, locationName) {
        const marker = L.marker([locationData.latitude, locationData.longitude]);
        const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);

        const popupContent = `
            <div class="popup-content">
                <h3 class="popup-title">${report.flowers.join(", ")}</h3> 
                <p><strong>מיקום:</strong> ${locationName}</p>
                <p><strong>תאריך:</strong> ${formattedDate}</p>
                <p><strong>דיווח מקורי:</strong> ${report.original_report}</p>
                <button onclick="flowerMapUtils.shareUtils.shareLocation(${locationData.latitude}, ${locationData.longitude}, '${report.flowers.join(", ")}')" 
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
            if(this.errorDiv){
                this.errorDiv.remove();
            }
        }, 5000);
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