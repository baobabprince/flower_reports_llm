class FlowerStatistics {
    constructor() {
        this.stats = {
            totalReports: 0,
            flowerTypes: {},
            topLocations: [],
            recentReports: [],
            monthlyTrends: {},
            mostCommonFlowers: [] // New property for most common flowers
        };
    }

    updateStatistics(reports, dateRange) {
        const filteredReports = reports.filter(report => {
            const date = flowerMapUtils.dateUtils.parseDate(report.date);
            return date && flowerMapUtils.dateUtils.isDateInRange(date, dateRange);
        });

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
            monthlyTrends: {},
            mostCommonFlowers: []
        };

        reports.forEach(report => {
            // Count flower types (handling arrays of flowers)
            if (Array.isArray(report.flowers)) {
                report.flowers.forEach(flower => {
                    this.stats.flowerTypes[flower] = 
                        (this.stats.flowerTypes[flower] || 0) + 1;
                });
            } else {
                this.stats.flowerTypes[report.flowers] = 
                    (this.stats.flowerTypes[report.flowers] || 0) + 1;
            }

            // Track monthly trends with proper date parsing
            const date = flowerMapUtils.dateUtils.parseDate(report.date);
            if (date) {
                const month = date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
                this.stats.monthlyTrends[month] = (this.stats.monthlyTrends[month] || 0) + 1;
            }
        });

        // Calculate most common flowers
        this.stats.mostCommonFlowers = Object.entries(this.stats.flowerTypes)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // Calculate top locations
        const locationCounts = {};
        reports.forEach(report => {
            locationCounts[report.locations] = (locationCounts[report.locations] || 0) + 1;
        });

        this.stats.topLocations = Object.entries(locationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);

        // Get recent reports with proper date sorting
        this.stats.recentReports = reports
            .sort((a, b) => {
                const dateA = flowerMapUtils.dateUtils.parseDate(a.date);
                const dateB = flowerMapUtils.dateUtils.parseDate(b.date);
                return dateB - dateA;
            })
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

        // Update most common flowers card
        const commonFlowers = document.getElementById('commonFlowers');
        if (commonFlowers) {
            commonFlowers.innerHTML = `
                <div class="card shadow-sm">
                    <div class="card-header">
                        <h3 class="text-lg font-semibold">פרחים נפוצים</h3>
                    </div>
                    <div class="card-body">
                        ${this.stats.mostCommonFlowers.map(([flower, count], index) => `
                            <div class="stat-item ${index < 3 ? 'top-flower' : ''}">
                                <span class="flower-name">${flower}</span>
                                <span class="flower-count">${count} דיווחים</span>
                                ${index < 3 ? '<span class="flower-badge">🌟</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

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

        // Update recent reports with properly formatted dates
        const recentReports = document.getElementById('recentReports');
        recentReports.innerHTML = this.stats.recentReports
            .map(report => `
                <div class="recent-report">
                    <span class="flower-name">${Array.isArray(report.flowers) ? report.flowers.join(', ') : report.flowers}</span>
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
        
        // Sort months chronologically
        const sortedMonths = Object.entries(this.stats.monthlyTrends)
            .sort(([a], [b]) => {
                const dateA = flowerMapUtils.dateUtils.parseDate('01 ' + a);
                const dateB = flowerMapUtils.dateUtils.parseDate('01 ' + b);
                return dateA - dateB;
            });

        const months = sortedMonths.map(([month]) => month);
        const counts = sortedMonths.map(([, count]) => count);

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