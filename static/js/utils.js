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

// Date formatting utility
const dateUtils = {
    formatDate: function(date) {
        try {
            // Handle both string dates and Date objects
            const dateObj = date instanceof Date ? date : new Date(date);
            
            // Check if date is valid
            if (isNaN(dateObj.getTime())) {
                console.warn(`Invalid date value: ${date}`);
                return 'Invalid date';
            }
            
            return new Intl.DateTimeFormat('he-IL').format(dateObj);
        } catch (error) {
            console.warn(`Error formatting date: ${date}`, error);
            return 'Invalid date';
        }
    },
    
    isDateInRange: function(date, range) {
        if (!range.from || !range.to) return true;
        try {
            const checkDate = new Date(date);
            if (isNaN(checkDate.getTime())) return false;
            return checkDate >= range.from && checkDate <= range.to;
        } catch (error) {
            return false;
        }
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