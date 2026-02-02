class FlowerMap {
    constructor() {
        this.map = null;
        this.markerCluster = null;
        this.dateRange = { from: null, to: null };
        this.currentMarkers = [];
        this.filteredReports = [];
        this.statistics = new FlowerStatistics();
        this.pikaday = null;
        this.currentPreset = null;
        this.sourceFilters = {
            tiuli: true,
            merged: true
        };
        this.allReports = [];

        // Initialize
        this.initializeMap();
        this.initializeDatePicker();
        this.initializeDatePresets();
        this.initializeSourceFilter();
        this.initializeTabs();

        // Load data
        this.loadData();
    }

    initializeTabs() {
        const tabs = document.querySelectorAll('.tab-button');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetViewId = tab.dataset.tab;
                
                // Update active tab
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update visible view
                document.querySelectorAll('.view').forEach(view => {
                    view.classList.add('hidden');
                });
                const targetView = document.getElementById(targetViewId);
                if (targetView) {
                    targetView.classList.remove('hidden');
                }

                // Refresh map if showing map view (fixes Leaflet size issues)
                if (targetViewId === 'map-view' && this.map) {
                    setTimeout(() => {
                        this.map.invalidateSize();
                    }, 100);
                }
            });
        });
    }

    initializeDatePresets() {
        const presetButtons = document.querySelectorAll('.chip-button');
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

        if (this.pikaday) {
            this.pikaday.setStartRange(from);
            this.pikaday.setEndRange(to);
        }

        this.updateSelectedDateLabel();
        this.processData();
    }

    updatePresetButtons(activePreset) {
        document.querySelectorAll('.chip-button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-preset') === activePreset);
        });
    }

    initializeMap() {
        flowerMapUtils.logger.info('Initializing map (Leaflet version)');

        this.map = L.map('map', {
            zoomControl: false // We can add it manually if we want custom position
        }).setView([31.7683, 35.2137], 8);

        L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        this.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true
        });

        this.map.addLayer(this.markerCluster);
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
            firstDay: 0,
            i18n: {
                previousMonth: 'חודש קודם',
                nextMonth: 'חודש הבא',
                months: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
                weekdays: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
                weekdaysShort: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
            },
            onSelect: (date) => this.handleDateSelect(date),
            onOpen: () => {
                if (this.dateRange.from) {
                    this.pikaday.setStartRange(this.dateRange.from);
                    this.pikaday.setEndRange(this.dateRange.to);
                }
            }
        });

        clearDates.addEventListener('click', () => this.clearDateFilter());

        // Close calendar when clicking outside
        document.addEventListener('click', (e) => {
            if (!datePickerButton.contains(e.target) && !calendar.contains(e.target)) {
                calendar.classList.add('hidden');
            }
        });

        datePickerButton.addEventListener('click', () => {
            calendar.classList.toggle('hidden');
        });
    }

    async loadData() {
        try {
            flowerMapUtils.logger.info('Loading flower reports');
            this.allReports = ALL_REPORTS; // Loaded from global var
            this.processData();
            flowerMapUtils.logger.info('Data loaded successfully');
        } catch (error) {
            console.error('Failed to load data', error);
        }
    }

    processData() {
        this.markerCluster.clearLayers();
        this.currentMarkers = [];
        
        this.filteredReports = this.allReports.filter(report => {
            try {
                let date = flowerMapUtils.dateUtils.parseDate(report.date); // Use utility if available or local logic
                if (!date || isNaN(date.getTime())) {
                    // Fallback parsing if utility fails or not present
                    if (typeof report.date === 'string') {
                        if (report.date.includes('/')) {
                            const [day, month, year] = report.date.split('/');
                            date = new Date(`${year}-${month}-${day}`);
                        } else if (report.date.includes('-')) {
                            const [year, month, day] = report.date.split('-');
                            date = new Date(`${year}-${month}-${day}`);
                        } else {
                            date = new Date(report.date);
                        }
                    }
                }

                if (!date || isNaN(date.getTime())) return false;

                const source = report.source || (report.source_file ? 'tiuli' : 'merged');
                
                // Simple date range check
                let inDateRange = true;
                if (this.dateRange.from) {
                    // Reset times for accurate day comparison
                    const d = new Date(date).setHours(0,0,0,0);
                    const from = new Date(this.dateRange.from).setHours(0,0,0,0);
                    if (d < from) inDateRange = false;
                    
                    if (inDateRange && this.dateRange.to) {
                        const to = new Date(this.dateRange.to).setHours(23,59,59,999);
                        if (d > to) inDateRange = false;
                    }
                }

                return inDateRange && this.sourceFilters[source];
            } catch (error) {
                return false;
            }
        });

        // Update Map
        this.filteredReports.forEach(report => {
            const marker = this.createMarker(report);
            if (marker) {
                this.currentMarkers.push(marker);
                this.markerCluster.addLayer(marker);
            }
        });

        // Update UI States
        const noDataOverlay = document.getElementById('no-data-overlay');
        if (this.filteredReports.length === 0) {
            if (noDataOverlay) noDataOverlay.classList.remove('hidden');
        } else {
            if (noDataOverlay) noDataOverlay.classList.add('hidden');
            try {
                const bounds = this.markerCluster.getBounds();
                if (bounds.isValid()) {
                    this.map.fitBounds(bounds, { padding: [50, 50] });
                }
            } catch(e) {}
        }

        // Update Components
        this.updateSelectedDateLabel(this.filteredReports.length);
        this.renderReportsList();
        this.statistics.updateStatistics(this.filteredReports); // Assuming stats takes filtered list
    }

    createMarker(report) {
        const lat = parseFloat(report.lat);
        const lon = parseFloat(report.lon);
        if (isNaN(lat) || isNaN(lon)) return null;

        const marker = L.marker([lat, lon]);
        const formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
        const source = report.source_file ? 'טיולי' : 'משולב';

        const popupContent = `
            <div class="popup-content">
                <h3 style="margin:0 0 8px 0; font-size:1.1rem;">${report.flowers}</h3>
                <div style="font-size:0.9rem; line-height:1.6;">
                    <div><strong>מיקום:</strong> ${report.title}</div>
                    <div><strong>תאריך:</strong> ${formattedDate}</div>
                    <div><strong>מקור:</strong> ${source}</div>
                </div>
                <p style="margin:8px 0; font-size:0.9rem; color:#555;">${report.description}</p>
            </div>
        `;

        marker.bindPopup(popupContent);
        return marker;
    }

    renderReportsList() {
        const grid = document.getElementById('reports-grid');
        const countLabel = document.getElementById('reports-count');
        if (!grid) return;

        grid.innerHTML = '';
        countLabel.textContent = `נמצאו ${this.filteredReports.length} דיווחים`;

        // Render first 100 for performance (could implement proper pagination)
        const displayLimit = 100;
        const reportsToShow = this.filteredReports.slice(0, displayLimit);

        reportsToShow.forEach(report => {
            const card = document.createElement('div');
            card.className = 'report-card';
            
            const date = flowerMapUtils.dateUtils.formatDate(report.date);
            const source = report.source_file ? 'טיולי' : 'משולב';

            card.innerHTML = `
                <div class="report-header">
                    <h3 class="report-title">${report.flowers}</h3>
                    <div class="report-meta">
                        <span>${date}</span>
                        <span>${source}</span>
                    </div>
                </div>
                <div class="report-body">
                    <p class="report-description" title="${report.description}">
                        ${report.description}
                    </p>
                </div>
                <div class="report-footer">
                    <span class="location-badge">${report.title}</span>
                </div>
            `;
            grid.appendChild(card);
        });

        if (this.filteredReports.length > displayLimit) {
            const more = document.createElement('div');
            more.style.gridColumn = "1 / -1";
            more.style.textAlign = "center";
            more.style.padding = "20px";
            more.style.color = "var(--text-secondary)";
            more.textContent = `מציג ${displayLimit} מתוך ${this.filteredReports.length} תוצאות...`;
            grid.appendChild(more);
        }
    }

    handleDateSelect(date) {
        const selectedDate = new Date(date);
        
        if (!this.dateRange.from || (this.dateRange.from && this.dateRange.to)) {
            // Start new range
            this.dateRange = { from: selectedDate, to: null };
            this.pikaday.setStartRange(selectedDate);
            this.pikaday.setEndRange(null);
            this.currentPreset = null;
            this.updatePresetButtons(null);
        } else {
            // Complete range
            if (selectedDate < this.dateRange.from) {
                this.dateRange.to = this.dateRange.from;
                this.dateRange.from = selectedDate;
            } else {
                this.dateRange.to = selectedDate;
            }
            this.pikaday.setStartRange(this.dateRange.from);
            this.pikaday.setEndRange(this.dateRange.to);
            document.getElementById('calendar').classList.add('hidden');
        }
        
        this.processData();
    }

    clearDateFilter() {
        this.dateRange = { from: null, to: null };
        this.currentPreset = null;
        this.pikaday.setStartRange(null);
        this.pikaday.setEndRange(null);
        this.updatePresetButtons(null);
        this.processData();
    }

    updateSelectedDateLabel(count) {
        const labelEl = document.getElementById('selectedDateRange');
        const clearBtn = document.getElementById('clearDates');
        
        let label = 'בחר תאריכים';

        if (this.dateRange.from) {
            const fromStr = flowerMapUtils.dateUtils.formatDate(this.dateRange.from);
            if (this.dateRange.to) {
                const toStr = flowerMapUtils.dateUtils.formatDate(this.dateRange.to);
                label = `${fromStr} - ${toStr}`;
            } else {
                label = `החל מ- ${fromStr}`;
            }
        } else if (this.currentPreset === 'all') {
            label = 'כל הזמן';
        }

        labelEl.textContent = label;
        
        if (clearBtn) {
            clearBtn.disabled = !this.dateRange.from && this.currentPreset !== 'all';
        }
    }

    initializeSourceFilter() {
        const tiuliCheckbox = document.getElementById('tiuli-filter');
        const mergedCheckbox = document.getElementById('merged-filter');

        if (tiuliCheckbox) {
            tiuliCheckbox.addEventListener('change', () => {
                this.sourceFilters.tiuli = tiuliCheckbox.checked;
                this.processData();
            });
        }

        if (mergedCheckbox) {
            mergedCheckbox.addEventListener('change', () => {
                this.sourceFilters.merged = mergedCheckbox.checked;
                this.processData();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof FlowerStatistics !== 'undefined') {
        window.flowerMap = new FlowerMap();
    } else {
        console.error('FlowerStatistics is not defined.');
    }
});