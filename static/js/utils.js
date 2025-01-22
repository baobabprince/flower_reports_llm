// Logging utility
const logger = {
    log: function(type, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            type,
            message,
            data
        };

        console.log(`[${type}][${timestamp}] ${message}`, data ? data : '');

        // Store in localStorage for debugging
        const logs = JSON.parse(localStorage.getItem('flowerMapLogs') || '[]');
        logs.unshift(logEntry);
        localStorage.setItem('flowerMapLogs', JSON.stringify(logs.slice(0, 100)));

        return logEntry;
    },

    error: function(message, error) {
        return this.log('ERROR', message, error);
    },

    info: function(message, data) {
        return this.log('INFO', message, data);
    },

    warn: function(message, data) {
        return this.log('WARN', message, data);
    }
};

// Enhanced date utilities
const dateUtils = {
    parseDate: function(input) {
        if (!input) return null;
        
        // If already a Date object, clone it
        if (input instanceof Date) {
            const date = new Date(input);
            return isNaN(date.getTime()) ? null : date;
        }

        // Try parsing ISO string
        if (typeof input === 'string') {
            // Try parsing ISO format
            let date = new Date(input);
            if (!isNaN(date.getTime())) {
                return date;
            }

            // Try parsing DD/MM/YYYY format
            const parts = input.split(/[\/.-]/);
            if (parts.length === 3) {
                // Assume DD/MM/YYYY format if separator is / or . or -
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // Months are 0-based
                const year = parseInt(parts[2], 10);
                
                date = new Date(year, month, day);
                
                // Validate the parsed date
                if (!isNaN(date.getTime()) &&
                    date.getDate() === day &&
                    date.getMonth() === month &&
                    date.getFullYear() === year) {
                    return date;
                }
            }
        }

        // If all parsing attempts fail
        return null;
    },

    formatDate: function(date, format = 'he-IL') {
        try {
            const parsedDate = this.parseDate(date);
            if (!parsedDate) {
                logger.warn(`Invalid date value: ${date}`);
                return 'Invalid date';
            }

            const options = {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            };

            return new Intl.DateTimeFormat(format, options).format(parsedDate);
        } catch (error) {
            logger.warn(`Error formatting date: ${date}`, error);
            return 'Invalid date';
        }
    },

    isDateInRange: function(date, range) {
        if (!range.from && !range.to) return true;

        try {
            const checkDate = this.parseDate(date);
            if (!checkDate) return false;

            // Normalize dates to start/end of day
            checkDate.setHours(0, 0, 0, 0);
            
            if (range.from) {
                const fromDate = this.parseDate(range.from);
                if (!fromDate) return false;
                fromDate.setHours(0, 0, 0, 0);
                if (checkDate < fromDate) return false;
            }

            if (range.to) {
                const toDate = this.parseDate(range.to);
                if (!toDate) return false;
                toDate.setHours(23, 59, 59, 999);
                if (checkDate > toDate) return false;
            }

            return true;
        } catch (error) {
            logger.error('Error checking date range', error);
            return false;
        }
    },

    compareDates: function(date1, date2) {
        const d1 = this.parseDate(date1);
        const d2 = this.parseDate(date2);
        
        if (!d1 || !d2) return null;

        // Normalize times to midnight
        d1.setHours(0, 0, 0, 0);
        d2.setHours(0, 0, 0, 0);

        return d1.getTime() - d2.getTime();
    }
};

// Share functionality
const shareUtils = {
    shareLocation: async function(lat, lon, flowerName) {
        const url = `https://www.google.com/maps?q=${lat},${lon}`;
        const text = `מצאתי ${flowerName} במיקום הזה!`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'שיתוף מיקום פריחה',
                    text: text,
                    url: url
                });
                logger.info('Location shared successfully');
            } else {
                this.fallbackShare(text, url);
            }
        } catch (error) {
            logger.error('Error sharing location', error);
            this.fallbackShare(text, url);
        }
    },

    fallbackShare: function(text, url) {
        const dummy = document.createElement('textarea');
        document.body.appendChild(dummy);
        dummy.value = `${text}\n${url}`;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        alert('הקישור הועתק ללוח!');
        logger.info('Location copied to clipboard');
    }
};

// Tab management
const tabUtils = {
    initialize: function() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    },

    switchTab: function(tabName) {
        // Update button states
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
        });

        // Update content visibility
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
        });

        logger.info(`Switched to ${tabName} tab`);
    }
};

// Export utilities
window.flowerMapUtils = {
    logger,
    dateUtils,
    shareUtils,
    tabUtils
};