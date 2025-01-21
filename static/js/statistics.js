class FlowerStatistics {
    constructor() {
        this.stats = {
            totalReports: 0,
            flowerTypes: {},
            topLocations: [],
            recentReports: [],
            monthlyTrends: {}
        };
    }
    
    updateStatistics(reports, dateRange) {
        const filteredReports = reports.filter(report => 
            flowerMapUtils.dateUtils.isDateInRange(report.date, dateRange)
        );
        
        this.calculateStats(filteredReports);
        this.updateUI();
        
        flowerMapUtils.logger.info('Statistics updated', {
            totalReports: this.stats.totalReports,
            uniqueFlowers: Object.keys(this.stats.flowerTypes).length
        });
    }
    
    calculateStats(reports) {
        // Reset statistics
        this.stats = {
            totalReports: reports.length,
            flowerTypes: {},
            topLocations: [],
            recentReports: [],
            monthlyTrends: {}
        };
        
        reports.forEach(report => {
            // Count flower types
            this.stats.flowerTypes[report.flowers] = 
                (this.stats.flowerTypes[report.flowers] || 0) + 1;
            
            // Track monthly trends
            const month = new Date(report.date).toLocaleString('he-IL', { month: 'long', year: 'numeric' });
            this.stats.monthlyTrends[month] = (this.stats.monthlyTrends[month] || 0) + 1;
        });
        
        // Calculate top locations
        const locationCounts = {};
        reports.forEach(report => {
            locationCounts[report.locations] = (locationCounts[report.locations] || 0) + 1;
        });
        
        this.stats.topLocations = Object.entries(locationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
        
        // Get recent reports
        this.stats.recentReports = reports
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
    }
    
    updateUI() {
        // Update general stats
        const generalStats = document.getElementById('generalStats');
        generalStats.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">סה"כ דיווחים:</span>
                <span class="stat-value">${this.stats.totalReports}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">סוגי פרחים:</span>
                <span class="stat-value">${Object.keys(this.stats.flowerTypes).length}</span>
            </div>
        `;
        
        // Update top locations
        const topLocations = document.getElementById('topLocations');
        topLocations.innerHTML = this.stats.topLocations
            .map(([location, count]) => `
                <div class="stat-item">
                    <span class="location-name">${location}</span>
                    <span class="location-count">${count} דיווחים</span>
                </div>
            `)
            .join('');
        
        // Update recent reports
        const recentReports = document.getElementById('recentReports');
        recentReports.innerHTML = this.stats.recentReports
            .map(report => `
                <div class="recent-report">
                    <span class="flower-name">${report.flowers}</span>
                    <span class="report-date">${flowerMapUtils.dateUtils.formatDate(report.date)}</span>
                    <span class="report-location">${report.locations}</span>
                </div>
            `)
            .join('');
        
        // Create monthly trends chart if Chart.js is available
        if (window.Chart && document.getElementById('monthlyTrendsChart')) {
            this.updateMonthlyTrendsChart();
        }
    }
    
    updateMonthlyTrendsChart() {
        const ctx = document.getElementById('monthlyTrendsChart').getContext('2d');
        const months = Object.keys(this.stats.monthlyTrends);
        const counts = Object.values(this.stats.monthlyTrends);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'דיווחים חודשיים',
                    data: counts,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'מגמות דיווחים חודשיים'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}