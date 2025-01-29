class FlowerStatistics {
    constructor() {
        this.generalStats = {};
        this.topLocations = [];
        this.recentReports = [];
        this.stats = {
            totalReports: 0,
            flowerTypes: {},
            topLocations: [],
            recentReports: [],
            monthlyTrends: {},
            mostCommonFlowers: []
        };
    }

    updateStatistics(reports, dateRange) {
        try {
            const filteredReports = reports.filter(report => {
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
                return flowerMapUtils.dateUtils.isDateInRange(report.date, dateRange);
            });

            this.calculateGeneralStats(filteredReports);
            this.calculateTopLocations(filteredReports);
            this.getRecentReports(filteredReports);
            this.calculateStats(filteredReports);
            this.updateUI();
            this.renderStats();
        } catch (error) {
            flowerMapUtils.logger.error('Error updating statistics', error);
        }
    }

    calculateGeneralStats(reports) {
        this.generalStats = {
            totalReports: reports.length,
           totalFlowers: reports.reduce((sum, report) => {
               let total = sum;
               report.locations.forEach(location => {
                   total += location.flowers.length;
               });
             return total;
             }, 0)

        };
    }


    calculateTopLocations(reports) {
        const locationCounts = {};
        reports.forEach(report => {
            report.locations.forEach(location => {
                 if (report.geocoded_locations[location.location_name]) {
                    locationCounts[location.location_name] = (locationCounts[location.location_name] || 0) + 1;
                  }

             });
        });

         this.topLocations = Object.entries(locationCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5) // Get top 5
            .map(([location, count]) => `${location} (${count})`);
    }

    getRecentReports(reports) {
         this.recentReports = reports
             .sort((a, b) => {
                let dateA;
                if (typeof a.date === 'string' && a.date.includes('/')) {
                   const [day, month, year] = a.date.split('/');
                     dateA = new Date(`${year}-${month}-${day}`);
                }
                else if (typeof a.date === 'string' && a.date.includes('-')) {
                    const [year, month, day] = a.date.split('-');
                    dateA = new Date(`${year}-${month}-${day}`);
                }
                else {
                  dateA = new Date(a.date);
                }

                let dateB;
                 if (typeof b.date === 'string' && b.date.includes('/')) {
                    const [day, month, year] = b.date.split('/');
                     dateB = new Date(`${year}-${month}-${day}`);
                }
                 else if (typeof b.date === 'string' && b.date.includes('-')) {
                    const [year, month, day] = b.date.split('-');
                    dateB = new Date(`${year}-${month}-${day}`);
                 }
                else {
                    dateB = new Date(b.date);
                }
                 return dateB - dateA; // Sort in descending order
             })
            .slice(0, 5)
            .map(report => {
                let formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
                const flowers = report.locations.flatMap(location => location.flowers).join(', ');
                return `${formattedDate}: ${flowers}`;
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
            report.locations.forEach(location => {
               location.flowers.forEach(flower => {
                    this.stats.flowerTypes[flower] =
                        (this.stats.flowerTypes[flower] || 0) + 1;
                });
            });


            // Track monthly trends with proper date parsing
             let date;
                if (typeof report.date === 'string' && report.date.includes('/')) {
                    const [day, month, year] = report.date.split('/');
                    date = new Date(`${year}-${month}-${day}`);
                }
                else if (typeof report.date === 'string' && report.date.includes('-')) {
                    const [year, month, day] = report.date.split('-');
                    date = new Date(`${year}-${month}-${day}`);
                }
                 else {
                     date = new Date(report.date);
                }
            if (date) {
                const month = date.toLocaleString('he-IL', { month: 'long', year: 'numeric' });
                this.stats.monthlyTrends[month] = (this.stats.monthlyTrends[month] || 0) + 1;
            }
        });

        // Calculate most common flowers
        this.stats.mostCommonFlowers = Object.entries(this.stats.flowerTypes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);


         // Calculate top locations
       const locationCounts = {};
        reports.forEach(report => {
            report.locations.forEach(location => {
                 if (report.geocoded_locations[location.location_name]) {
                    locationCounts[location.location_name] = (locationCounts[location.location_name] || 0) + 1;
                 }
             });
        });

        this.stats.topLocations = Object.entries(locationCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);

        // Get recent reports with proper date sorting
       this.stats.recentReports = reports
            .sort((a, b) => {
                let dateA;
               if (typeof a.date === 'string' && a.date.includes('/')) {
                    const [day, month, year] = a.date.split('/');
                     dateA = new Date(`${year}-${month}-${day}`);
                }
                else if (typeof a.date === 'string' && a.date.includes('-')) {
                     const [year, month, day] = a.date.split('-');
                    dateA = new Date(`${year}-${month}-${day}`);
                }
                else {
                   dateA = new Date(a.date);
                }

                let dateB;
                if (typeof b.date === 'string' && b.date.includes('/')) {
                    const [day, month, year] = b.date.split('/');
                    dateB = new Date(`${year}-${month}-${day}`);
                }
                else if (typeof b.date === 'string' && b.date.includes('-')) {
                     const [year, month, day] = b.date.split('-');
                    dateB = new Date(`${year}-${month}-${day}`);
                }
                else {
                   dateB = new Date(b.date);
                 }
                 return dateB - dateA;
            })
            .slice(0, 5);
    }

    updateUI() {
        // Update general stats
        const generalStats = document.getElementById('generalStats');
        if (generalStats) {
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
        }


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
        if (topLocations) {
            topLocations.innerHTML = this.stats.topLocations
                .map(([location, count]) => `
                    <div class="stat-item">
                        <span class="location-name">${location}</span>
                        <span class="location-count">${count} דיווחים</span>
                    </div>
                `)
                .join('');
        }


        // Update recent reports with properly formatted dates
        const recentReports = document.getElementById('recentReports');
        if (recentReports) {
            recentReports.innerHTML = this.stats.recentReports
                .map(report => {
                   let formattedDate = flowerMapUtils.dateUtils.formatDate(report.date);
                    const flowers = report.locations.flatMap(location => location.flowers).join(', ');
                    const locations = report.locations.map(location => location.location_name).join(', ')
                    return `
                         <div class="recent-report">
                            <span class="flower-name">${flowers}</span>
                            <span class="report-date">${formattedDate}</span>
                            <span class="report-location">${locations}</span>
                       </div>
                    `;
                })
                .join('');
        }

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
                let dateA;
                if (typeof a === 'string' && a.includes('/')) {
                    const [day, month, year] = a.split('/');
                    dateA = new Date(`${year}-${month}-${day}`);
                 } else if (typeof a === 'string' && a.includes('-')) {
                     const [year, month, day] = a.split('-');
                     dateA = new Date(`${year}-${month}-${day}`);
                } else {
                     dateA = new Date('01 ' + a)
                }


                let dateB;
               if (typeof b === 'string' && b.includes('/')) {
                    const [day, month, year] = b.split('/');
                     dateB = new Date(`${year}-${month}-${day}`);
                } else if (typeof b === 'string' && b.includes('-')) {
                    const [year, month, day] = b.split('-');
                    dateB = new Date(`${year}-${month}-${day}`);
                }else {
                    dateB = new Date('01 ' + b);
                 }
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

    renderStats() {
        const generalStatsDiv = document.getElementById('generalStats');
        const topLocationsDiv = document.getElementById('topLocations');
        const recentReportsDiv = document.getElementById('recentReports');


        generalStatsDiv.innerHTML = `
          <p><strong>סה"כ דיווחים:</strong> ${this.generalStats.totalReports}</p>
          <p><strong>סה"כ פרחים:</strong> ${this.generalStats.totalFlowers}</p>
        `;
        topLocationsDiv.innerHTML = this.topLocations.map(loc => `<p>${loc}</p>`).join('');
        recentReportsDiv.innerHTML = this.recentReports.map(report => `<p>${report}</p>`).join('');
    }
}