class FlowerMap {
    constructor() {
        this.map = null;
        this.markerCluster = null;
        this.dateRange = { from: null, to: null };
        this.currentMarkers = [];
        this.statistics = new FlowerStatistics();
        
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
        
        // Replace the OpenStreetMap tile layer with a custom styled layer
        var customStyledLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: 'Map data: © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            className: 'openstreetmap' // Add your custom style class here
        });
        customStyledLayer.addTo(this.map);

        // Initialize marker cluster group
        this.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });
        
        this.map.addLayer(this.markerCluster);

        // Fetch and display the last update date
        this.displayLastUpdateDate();
    }

    displayLastUpdateDate() {
        fetch('./static/reports.json')
            .then(response => response.json())
            .then(data => {
                const dates = data.map(report => new Date(report.date));
                const latestDate = new Date(Math.max.apply(null, dates));
                const formattedDate = latestDate.toLocaleDateString('en-HE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
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
        
        // Initialize date picker library
        const picker = new Pikaday({
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
        
        // Close calendar when clicking outside
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
            console.log("Loaded data:", data); // Added this line
            this.processData(data);
            this.statistics.updateStatistics(data, this.dateRange);
            
            flowerMapUtils.logger.info('Data loaded successfully', { count: data.length });
        } catch (error) {
            flowerMapUtils.logger.error('Failed to load data', error);
            this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
        }
    }
    
    processData(reports) {
        console.log("Processing data", reports); // Added this line
        this.markerCluster.clearLayers();
        this.currentMarkers = [];
        
        const filteredReports = reports.filter(report => {
            return flowerMapUtils.dateUtils.isDateInRange(report.date, this.dateRange);
        });
        
        console.log("Filtered reports", filteredReports); // Added this line

        filteredReports.forEach(report => {
            // Loop through each geocoded location and create a marker
            for (const locationName in report.geocoded_locations) {
                if (report.geocoded_locations.hasOwnProperty(locationName)) {
                    const locationData = report.geocoded_locations[locationName];
                    // Create a marker for each location
                    const marker = this.createMarker(report, locationData, locationName);
                    this.currentMarkers.push(marker);
                    this.markerCluster.addLayer(marker);
                }
            }
        });
        
        flowerMapUtils.logger.info('Markers updated', {
            total: reports.length,
            filtered: filteredReports.length
        });
    }
    
    createMarker(report, locationData, locationName) {
        // Use the locationData to get lat and lon
        const marker = L.marker([locationData.latitude, locationData.longitude]);
        
         const popupContent = `
            <div class="popup-content">
                 <h3 class="popup-title">${report.flowers.join(", ")}</h3> 
                <p><strong>מיקום:</strong> ${locationName}</p>
                <p><strong>תאריך:</strong> ${flowerMapUtils.dateUtils.formatDate(report.date)}</p>
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
        if (!this.dateRange.from || this.dateRange.to) {
            // Start new range
            this.dateRange = { from: date, to: null };
            document.getElementById('selectedDateRange').textContent = 
                flowerMapUtils.dateUtils.formatDate(date);
        } else {
            // Complete the range
            if (date < this.dateRange.from) {
                this.dateRange = { from: date, to: this.dateRange.from };
            } else {
                this.dateRange.to = date;
            }
            
            document.getElementById('selectedDateRange').textContent = 
                `${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} - ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;
            
            document.getElementById('calendar').classList.add('hidden');
            this.loadData(); // Reload data with new date range
        }
    }
    
    clearDateFilter() {
        this.dateRange = { from: null, to: null };
        document.getElementById('selectedDateRange').textContent = 'בחר תאריכים';
        this.loadData();
        flowerMapUtils.logger.info('Date filter cleared');
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.card-header').appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Initialize the map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.flowerMap = new FlowerMap();
});