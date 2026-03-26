document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('Failed to fetch attendance data');
        const employees = await response.json();
        
        // 1. Update Stat Cards & Metrics
        const totalEmployees = employees.length;
        document.querySelector('#total-employees .card-value').textContent = totalEmployees;
        document.getElementById('emp-count-badge').textContent = totalEmployees;
        
        // Calculate Total Working Days
        const dateKeys = Object.keys(employees[0]).filter(key => key.startsWith('2026-'));
        // A "Working Day" is a date key where status is NOT 'SUNDAY', 'NA', or '--' for at least some employees
        // But more accurately, we can just count the keys that are not explicitly marked as SUNDAY
        const workingDays = dateKeys.filter(date => {
            const sampleStatus = employees[0][date];
            return sampleStatus !== 'SUNDAY' && sampleStatus !== 'NA' && sampleStatus !== '--';
        }).length;
        document.querySelector('#total-days .card-value').textContent = workingDays;
        
        // Calculate Average Attendance
        const avgPerc = employees.reduce((sum, emp) => sum + parseFloat(emp.Percentage || 0), 0) / totalEmployees;
        document.querySelector('#avg-attendance .card-value').textContent = avgPerc.toFixed(1) + '%';
        
        // Find Top Performer
        const topEmp = employees.reduce((prev, current) => (parseFloat(prev.Percentage) > parseFloat(current.Percentage)) ? prev : current);
        const topName = topEmp['Employee Name'] || 'Employee';
        document.querySelector('#top-perf .card-value').textContent = topName.split(' ')[0];

        // 2. Setup Navigation
        setupNavigation(employees);

        // 3. Render Views
        renderTable(employees);
        renderEmployeeDetails(employees);
        renderReports(employees);

        // 3. Setup Filters
        const searchInput = document.getElementById('employee-search');
        const branchFilter = document.getElementById('branch-filter');
        const attendanceFilter = document.getElementById('attendance-filter');

        // Populate Branch Filter
        const branches = [...new Set(employees.map(emp => emp.Branch))].filter(Boolean).sort();
        branches.forEach(branch => {
            const option = document.createElement('option');
            option.value = branch;
            option.textContent = branch;
            branchFilter.appendChild(option);
        });

        const applyFilters = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedBranch = branchFilter.value;
            const selectedAttendance = attendanceFilter.value;

            const filtered = employees.filter(emp => {
                const matchesSearch = emp['Employee Name'].toLowerCase().includes(searchTerm) || 
                                     emp['Employee ID'].toLowerCase().includes(searchTerm);
                
                const matchesBranch = selectedBranch === 'all' || emp.Branch === selectedBranch;
                
                const perc = parseFloat(emp.Percentage || 0);
                let matchesAttendance = true;
                if (selectedAttendance === 'excellent') matchesAttendance = perc > 90;
                else if (selectedAttendance === 'good') matchesAttendance = perc >= 75 && perc <= 90;
                else if (selectedAttendance === 'low') matchesAttendance = perc < 75;

                return matchesSearch && matchesBranch && matchesAttendance;
            });

            renderTable(filtered);
        };

        searchInput.addEventListener('input', applyFilters);
        branchFilter.addEventListener('change', applyFilters);
        attendanceFilter.addEventListener('change', applyFilters);

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
        
        // Calculate stats for this employee
        const dateKeys = Object.keys(emp).filter(key => key.startsWith('2026-'));
        let daysPresent = 0;
        let daysLeave = 0;
        
        dateKeys.forEach(date => {
            const status = emp[date];
            if (!status || status === 'SUNDAY' || status === 'NA' || status === '--') return;
            if (status === 'leave') daysLeave++;
            else daysPresent++;
        });
        
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
                <span class="status-badge view">
                    <span>P: <b>${daysPresent}</b></span>
                    <span class="sep">|</span>
                    <span>L: <b>${daysLeave}</b></span>
                </span>
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
                borderColor: '#0f172a',
                backgroundColor: 'rgba(15, 23, 42, 0.05)',
                fill: true,
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 4,
                pointBackgroundColor: '#0f172a'
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
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#64748b' }
                },
                x: { 
                    grid: { display: false },
                    ticks: { color: '#64748b' }
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
                backgroundColor: ['#2563eb', '#f59e0b'],
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
                    labels: { color: '#64748b', padding: 20, font: { family: 'Outfit', size: 12 } }
                }
            }
        }
    });
}

function setupNavigation(data) {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.dashboard-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.id.replace('nav-', 'view-');
            
            // Update nav active state
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Update view visibility
            views.forEach(v => {
                if (v.id === targetId) {
                    v.style.display = 'block';
                    v.classList.add('active');
                } else {
                    v.style.display = 'none';
                    v.classList.remove('active');
                }
            });
        });
    });
}

function renderEmployeeDetails(data) {
    const grid = document.getElementById('employee-details-grid');
    grid.innerHTML = '';

    data.forEach(emp => {
        const dateKeys = Object.keys(emp).filter(key => key.startsWith('2026-'));
        let p = 0, l = 0;
        dateKeys.forEach(d => {
            const s = emp[d];
            if (!s || s === 'SUNDAY' || s === 'NA' || s === '--') return;
            if (s === 'leave') l++; else p++;
        });

        const card = document.createElement('div');
        card.className = 'card employee-detail-card glass';
        card.innerHTML = `
            <div class="emp-detail-header">
                <div>
                    <div class="emp-detail-name">${emp['Employee Name']}</div>
                    <div class="emp-detail-id">ID: ${emp['Employee ID']}</div>
                </div>
                <div class="badge">${emp['Branch']}</div>
            </div>
            <div class="emp-stats-row">
                <div class="emp-stat-box">
                    <span class="emp-stat-val">${p}</span>
                    <span class="emp-stat-label">Present</span>
                </div>
                <div class="emp-stat-box">
                    <span class="emp-stat-val">${l}</span>
                    <span class="emp-stat-label">Leaves</span>
                </div>
            </div>
            <div style="margin-top: 0.5rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 0.25rem;">
                    <span>Attendance Rate</span>
                    <span>${parseFloat(emp.Percentage || 0).toFixed(1)}%</span>
                </div>
                <div class="perc-bar-container" style="width: 100%; height: 8px;">
                    <div class="perc-bar" style="width: ${emp.Percentage}%"></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderReports(data) {
    const head = document.getElementById('reports-head');
    const body = document.getElementById('reports-body');
    
    // Get all keys from first employee
    const keys = Object.keys(data[0]);
    
    // Header
    let headHtml = '<tr>';
    keys.forEach(k => headHtml += `<th>${k}</th>`);
    headHtml += '</tr>';
    head.innerHTML = headHtml;

    // Body
    let bodyHtml = '';
    data.forEach(emp => {
        bodyHtml += '<tr>';
        keys.forEach(k => {
            const val = emp[k] || '';
            bodyHtml += `<td>${val}</td>`;
        });
        bodyHtml += '</tr>';
    });
    body.innerHTML = bodyHtml;
}
