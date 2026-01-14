class FlowerMap {
    constructor() {
        this.map = null;
        this.markerCluster = null;
        this.dateRange = { from: null, to: null };
        this.currentMarkers = [];
        this.statistics = new FlowerStatistics();
        this.pikaday = null;
        this.errorDiv = null;
        this.currentPreset = null;
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
        this.initializeDatePresets();
        this.initializeSourceFilter();
        flowerMapUtils.tabUtils.initialize();

        // Load initial data
        this.loadData();
    }

    initializeDatePresets() {
        const presetButtons = document.querySelectorAll('.date-preset');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                this.applyPreset(preset);
            });
        });
    }

    applyPreset(preset) {
        const now = new Date();
        let from = null;
        let to = null;

        // Track which preset is active and update visuals
        this.currentPreset = preset;
        this.updatePresetButtons(preset);

        if (preset === 'all') {
            from = null;
            to = null;
        } else if (preset === '7') {
            to = new Date(now);
            from = new Date(now);
            from.setDate(now.getDate() - 7);
        } else if (preset === '30') {
            to = new Date(now);
            from = new Date(now);
            from.setDate(now.getDate() - 30);
        } else if (preset === 'year') {
            to = new Date(now);
            from = new Date(now.getFullYear(), 0, 1);
        }

        this.dateRange = { from, to };

        // Reflect the selection visually in the calendar
        if (this.pikaday) {
            this.pikaday.setStartRange(from);
            this.pikaday.setEndRange(to);
        }

        // Update label (count will be appended after processData runs)
        this.updateSelectedDateLabel();

        this.processData();
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
            firstDay: 0, // week starts on Sunday in local Israeli convention
            i18n: {
                previousMonth: 'חודש קודם',
                nextMonth: 'חודש הבא',
                months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
                weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
                weekdaysShort: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
            },
            onSelect: (date) => {
                this.handleDateSelect(date);
            },
            onOpen: () => {
                // When opening the calendar, show the currently selected range
                if (this.dateRange && (this.dateRange.from || this.dateRange.to)) {
                    this.pikaday.setStartRange(this.dateRange.from);
                    this.pikaday.setEndRange(this.dateRange.to);
                }
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
            this.allReports = ALL_REPORTS;
            this.processData();
            this.statistics.updateStatistics(this.allReports, this.dateRange,this.sourceFilters);
            flowerMapUtils.logger.info('Data loaded successfully', { count: this.allReports.length });
        } catch (error) {
            flowerMapUtils.logger.error('Failed to load data', error);
            this.showError('לא ניתן לטעון את הנתונים. אנא נסה שוב מאוחר יותר.');
        }
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
                }
                 else {
                    date = new Date(report.date);
                }
                if (isNaN(date.getTime())) {
                     flowerMapUtils.logger.warn('Invalid date in report', { report });
                     return false;
                 }

                 const source = report.source_file ? 'tiuli' : 'merged';
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

        const markersAdded = this.currentMarkers.length;
        const noDataEl = document.getElementById('no-data');
        if (markersAdded === 0) {
            // Show friendly message when no markers are available for the selected range
            if (noDataEl) noDataEl.classList.remove('hidden');
            // Reset view to default
            try { this.map.setView([31.7683, 35.2137], 8); } catch (e) {}
        } else {
            if (noDataEl) noDataEl.classList.add('hidden');
            // Fit bounds to markers for a better view
            try {
                const bounds = this.markerCluster.getBounds();
                if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            } catch (e) {
                // ignore
            }
        }

        // Update the label to reflect the current date selection and how many reports were found
        this.updateSelectedDateLabel(markersAdded);

        flowerMapUtils.logger.info('Markers updated', {
           total: this.allReports.length,
            filtered: filteredReports.length,
            markersAdded: markersAdded
        });
    }

    updateSelectedDateLabel(count) {
        const labelEl = document.getElementById('selectedDateRange');
        if (!labelEl) return;

        let label = '';

        if (this.dateRange.from && this.dateRange.to) {
            label = `מ ${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} עד ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;
        } else if (this.dateRange.from && !this.dateRange.to) {
            label = `מ ${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)}`;
        } else if (this.currentPreset) {
            switch (this.currentPreset) {
                case 'all': label = 'כל הזמן'; break;
                case '7': label = '7 ימים אחרונים'; break;
                case '30': label = '30 ימים אחרונים'; break;
                case 'year': label = 'השנה'; break;
                default: label = 'בחר תאריכים';
            }
        } else {
            label = 'בחר תאריכים';
        }

        if (typeof count === 'number') {
            label = `${label} — ${count} דיווחים`;
        }

        labelEl.textContent = label;

        // Update clear button enabled state
        const clearBtn = document.getElementById('clearDates');
        if (clearBtn) {
            clearBtn.disabled = !(this.dateRange.from || this.dateRange.to || (this.currentPreset && this.currentPreset !== 'all'));
            clearBtn.style.opacity = clearBtn.disabled ? '0.6' : '1';
            clearBtn.style.cursor = clearBtn.disabled ? 'not-allowed' : 'pointer';
        }
    }

    updatePresetButtons(activePreset) {
        const presetButtons = document.querySelectorAll('.date-preset');
        presetButtons.forEach(btn => {
            const isActive = activePreset && btn.getAttribute('data-preset') === activePreset;
            btn.classList.toggle('active', !!isActive);
        });
    }

    createMarker(report) {
        // Validate coordinates
        const lat = report.lat;
        const lon = report.lon;
        if (lat === undefined || lon === undefined || lat === null || lon === null || isNaN(Number(lat)) || isNaN(Number(lon))) {
            flowerMapUtils.logger.warn('Skipping marker with invalid coordinates', { report });
            return null;
        }

        const marker = L.marker([Number(lat), Number(lon)]);
        const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
        const source = report.source_file ? 'tiuli' : 'merged';

        const popupContent = `
            <div class="popup-content">
                <h3 class="popup-title">${report.flowers}</h3>
                <p><strong>מיקום:</strong> ${report.title}</p>
                <p><strong>תאריך:</strong> ${formattedDate}</p>
                <p><strong>מקור:</strong> ${source}</p>
                <p><strong>דיווח מקורי:</strong> ${report.description}</p>
                <button onclick="flowerMapUtils.shareUtils.shareLocation(${Number(lat)}, ${Number(lon)}, '${report.flowers}')"
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
        // If we're starting a new range (no from yet or an existing full range), set the start
        if (!this.dateRange.from || this.dateRange.to) {
            this.dateRange = {
                from: selectedDate,
                to: null
            };
            if (this.pikaday) this.pikaday.setStartRange(selectedDate);

            // Show a Hebrew single-start label
            document.getElementById('selectedDateRange').textContent =
                `מ ${flowerMapUtils.dateUtils.formatDate(date)}`;

            // When the user manually picks dates, clear any preset highlight
            this.currentPreset = null;
            this.updatePresetButtons(null);
        } else {
            // Complete the range
            const currentFromDate = new Date(this.dateRange.from);
            if (flowerMapUtils.dateUtils.compareDates(selectedDate, currentFromDate) < 0) {
                this.dateRange = {
                    from: selectedDate,
                    to: currentFromDate,
                };
            } else if (flowerMapUtils.dateUtils.compareDates(selectedDate, currentFromDate) === 0) {
                this.dateRange.to = selectedDate;
            } else {
                this.dateRange.to = selectedDate;
            }

            // Highlight range in calendar
            if (this.pikaday) {
                this.pikaday.setStartRange(this.dateRange.from);
                this.pikaday.setEndRange(this.dateRange.to);
            }

            // Use a Hebrew connector 'עד' and hide calendar
            document.getElementById('selectedDateRange').textContent =
                `מ ${flowerMapUtils.dateUtils.formatDate(this.dateRange.from)} עד ${flowerMapUtils.dateUtils.formatDate(this.dateRange.to)}`;

            document.getElementById('calendar').classList.add('hidden');
        }

        this.processData();
    }

    clearDateFilter() {
        this.dateRange = { from: null, to: null };
        this.currentPreset = null;

        // Clear Pikaday visual ranges
        if (this.pikaday) {
            this.pikaday.setStartRange(null);
            this.pikaday.setEndRange(null);
        }

        document.getElementById('selectedDateRange').textContent = 'בחר תאריכים';
        this.updatePresetButtons(null);
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
