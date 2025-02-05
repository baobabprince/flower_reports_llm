const flowerMapUtils = {
    dateUtils: {
        formatDate(dateString, locale = 'en-HE') {
            try {
               if (!dateString || (typeof dateString === 'string' && dateString.trim() === '')) {
                   return 'Invalid date';
               }
               let date;
               if (typeof dateString === 'string' && dateString.includes('/')) {
                 // Assuming DD/MM/YYYY format
                 const [day, month, year] = dateString.split('/');
                 date = new Date(`${year}-${month}-${day}`);
               } else {
                   // Try parsing as a standard date string
                   date = new Date(dateString);
               }


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
               let date;
               if (typeof dateString === 'string' && dateString.includes('/')) {
                 // Assuming DD/MM/YYYY format
                 const [day, month, year] = dateString.split('/');
                 date = new Date(`${year}-${month}-${day}`);
               } else {
                   // Try parsing as a standard date string
                   date = new Date(dateString);
               }
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
               let d1;
                if (typeof date1 === 'string' && date1.includes('/')) {
                 // Assuming DD/MM/YYYY format
                   const [day, month, year] = date1.split('/');
                    d1 = new Date(`${year}-${month}-${day}`);
               } else {
                 // Try parsing as a standard date string
                   d1 = new Date(date1);
               }


               let d2;
                 if (typeof date2 === 'string' && date2.includes('/')) {
                 // Assuming DD/MM/YYYY format
                   const [day, month, year] = date2.split('/');
                   d2 = new Date(`${year}-${month}-${day}`);
               } else {
                 // Try parsing as a standard date string
                   d2 = new Date(date2);
               }

                if (isNaN(d1.getTime())) {
                   flowerMapUtils.logger.warn('Invalid date1 passed to compareDates', { date1 });
                   return NaN; // Or throw an error, depending on desired behavior
               }

                if (isNaN(d2.getTime())) {
                   flowerMapUtils.logger.warn('Invalid date2 passed to compareDates', { date2 });
                   return NaN; // Or throw, depending on your needs
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
             const tabButtons = document.querySelectorAll('.tab-button');
             const tabContents = document.querySelectorAll('.tab-content');

           tabButtons.forEach(button => {
               button.addEventListener('click', () => {
                  const tabId = button.getAttribute('data-tab') + '-tab';
                   tabButtons.forEach(btn => btn.classList.remove('active'));
                   tabContents.forEach(content => content.classList.add('hidden'));


                    button.classList.add('active');
                   document.getElementById(tabId).classList.remove('hidden');
                   if (tabId === 'stats-tab') {
                     window.flowerMap.loadData()
                    }
               });
           });
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


           const tiuliReports = tiuliData.reports.map(report => ({...report, source: 'tiuli'}));
             const mergedReports = mergedData.reports.map(report => ({...report, source: 'merged'}));

            const allReports = [...tiuliReports, ...mergedReports];


            this.processData(allReports);
            this.statistics.updateStatistics(allReports, this.dateRange,this.sourceFilters);
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
                flowerMapUtils.logger.warn('skipping report due to missing geocoded_locations', {report});
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
                              flowerMapUtils.logger.error('Error creating marker', {report, location, error});
                         }
                     } else {
                         flowerMapUtils.logger.warn('skipping invalid location:', {location, report});
                     }
                 }
             } else {
                 flowerMapUtils.logger.warn('Report locations is not an array', {report});
             }

         });

        flowerMapUtils.logger.info('Markers updated', {
           total: reports.length,
            filtered: filteredReports.length
        });
    }
    createMarker(report, locationData, locationName) {

         if (!locationData || typeof locationData !== 'object' || locationData === null) {
             flowerMapUtils.logger.error('Invalid locationData passed to createMarker', {locationData, report, locationName});
             return null;
         }
          if(!report){
             flowerMapUtils.logger.error('Invalid report passed to createMarker', {report, locationData, locationName});
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
