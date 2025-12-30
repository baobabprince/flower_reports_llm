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

        // Set development mode (true for development, false for production)
        this.IS_DEVELOPMENT = true;

        // Initialize the map
        this.initializeMap();
        this.initializeDatePicker();
        this.initializeSourceFilter();
        flowerMapUtils.tabUtils.initialize();

        // Load initial data
        this.processData(ALL_REPORTS);
    }

    initializeMap() {
        flowerMapUtils.logger.info('Initializing map (Leaflet version)');

        this.map = L.map('map').setView([31.7683, 35.2137], 8);

        //  Simple OSM tile layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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


    processData(reports) {
        this.markerCluster.clearLayers();
        this.currentMarkers = [];

        const filteredReports = reports.filter(report => {
            return flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange);
        });

        filteredReports.forEach(report => {
            const marker = this.createMarker(report);
            this.currentMarkers.push(marker);
            this.markerCluster.addLayer(marker);
        });

        flowerMapUtils.logger.info('Markers updated', {
           total: reports.length,
            filtered: filteredReports.length
        });
    }
    createMarker(report) {
        const marker = L.marker([report.lat, report.lon]);
        const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);

        const popupContent = `
            <div class="popup-content">
                <h3 class="popup-title">${report.flowers}</h3>
                <p><strong>מיקום:</strong> ${report.title}</p>
                <p><strong>תאריך:</strong> ${formattedDate}</p>
                <p><strong>דיווח מקורי:</strong> ${report.description}</p>
                <button onclick="flowerMapUtils.shareUtils.shareLocation(${report.lat}, ${report.lon}, '${report.flowers}')"
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