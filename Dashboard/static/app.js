document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Failed to fetch attendance data');
        const employees = await response.json();
        
        // 1. Update Stat Cards
        const totalEmployees = employees.length;
        document.querySelector('#total-employees .card-value').textContent = totalEmployees;
        
        // Calculate Average Attendance
        const avgPerc = employees.reduce((sum, emp) => sum + parseFloat(emp.Percentage || 0), 0) / totalEmployees;
        document.querySelector('#avg-attendance .card-value').textContent = avgPerc.toFixed(1) + '%';
        
        // Find Top Performer
        const topEmp = employees.reduce((prev, current) => (parseFloat(prev.Percentage) > parseFloat(current.Percentage)) ? prev : current);
        const topName = topEmp['Employee Name'] || 'Employee';
        document.querySelector('#top-perf .card-value').textContent = topName.split(' ')[0];

        // 2. Render Table
        renderTable(employees);

        // 3. Setup Search
        const searchInput = document.getElementById('employee-search');
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = employees.filter(emp => 
                emp['Employee Name'].toLowerCase().includes(term) || 
                emp['Employee ID'].toLowerCase().includes(term)
            );
            renderTable(filtered);
        });

        // 4. Setup Charts
        setupCharts(employees);

        // Remove Loader
        setTimeout(() => {
            document.getElementById('loading-overlay').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading-overlay').style.display = 'none';
            }, 500);
        }, 800);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        document.getElementById('loading-overlay').innerHTML = `
            <div class="error-msg" style="text-align: center; color: white; padding: 2rem;">
                <h2 style="margin-bottom: 1rem;">Error Loading Data</h2>
                <p style="margin-bottom: 2rem; opacity: 0.8;">${error.message}</p>
                <button onclick="location.reload()" class="btn btn-primary">Retry</button>
            </div>
        `;
    }
}

function renderTable(data) {
    const listBody = document.getElementById('employee-list');
    listBody.innerHTML = '';

    data.forEach(emp => {
        const tr = document.createElement('tr');
        const perc = parseFloat(emp.Percentage || 0);
        const name = emp['Employee Name'];
        
        tr.innerHTML = `
            <td>
                <div class="emp-info">
                    <span>${name}</span>
                </div>
            </td>
            <td>${emp['Employee ID']}</td>
            <td>${emp['Branch']}</td>
            <td>${emp['Attendence']}</td>
            <td>
                <div class="perc-bar-container">
                    <div class="perc-bar" style="width: ${perc}%"></div>
                </div>
                ${perc.toFixed(1)}%
            </td>
            <td>
                <span class="status-badge view">View Detail</span>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

function setupCharts(data) {
    // 1. Daily Attendance Trend
    // We need to count how many employees were present each day
    const dateKeys = Object.keys(data[0]).filter(key => key.startsWith('2026-'));
    const dailyCounts = dateKeys.map(date => {
        return data.filter(emp => {
            const status = emp[date];
            // Present if it's a time string or not 'leave', 'NA', '--', 'SUNDAY'
            if (!status) return false;
            if (status === 'leave' || status === 'NA' || status === '--' || status === 'SUNDAY') return false;
            return true;
        }).length;
    });

    const trendCtx = document.getElementById('attendanceTrendChart').getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: dateKeys.map(d => d.split('-')[2]), // Just the day number
            datasets: [{
                label: 'Present Count',
                data: dailyCounts,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#6366f1'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });

    // 2. Monthly Status (Present vs Leave)
    let totalPresent = 0;
    let totalLeave = 0;

    data.forEach(emp => {
        dateKeys.forEach(date => {
            const status = emp[date];
            if (!status || status === 'SUNDAY' || status === 'NA' || status === '--') return;
            if (status === 'leave') totalLeave++;
            else totalPresent++;
        });
    });

    const distCtx = document.getElementById('statusDistChart').getContext('2d');
    new Chart(distCtx, {
        type: 'doughnut',
        data: {
            labels: ['Present', 'Leave'],
            datasets: [{
                data: [totalPresent, totalLeave],
                backgroundColor: ['#4ade80', '#f87171'],
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', padding: 20, font: { family: 'Outfit', size: 12 } }
                }
            }
        }
    });
}
