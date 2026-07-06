let allSubmissions = [];
let charts = {
    avgTime: null,
    topRoles: null,
    regions: null,
    meaningful: null
};

document.addEventListener('DOMContentLoaded', () => {
    // Icons
    lucide.createIcons();

    fetchDataAndBuildDashboard();
    setupFilterListeners();
});

function fetchDataAndBuildDashboard() {
    fetch('/api/submissions')
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                console.log('Belum ada data refleksi masuk.');
                return;
            }

            allSubmissions = data;
            populateNameDatalist(data);
            populateRegionFilter(data);
            filterAndBuildDashboard();
        })
        .catch(err => {
            console.error('Gagal mengambil data submissions:', err);
        });
}

function populateNameDatalist(data) {
    const datalist = document.getElementById('namaList');
    const names = new Set();
    
    data.forEach(item => {
        if (item.selectedUser?.name) {
            names.add(item.selectedUser.name);
        }
    });

    datalist.innerHTML = '';
    Array.from(names).sort().forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        datalist.appendChild(option);
    });
}

function populateRegionFilter(data) {
    const filterWilayah = document.getElementById('filterWilayah');
    const regions = new Set();
    
    data.forEach(item => {
        if (item.selectedUser?.region) {
            regions.add(item.selectedUser.region);
        }
    });

    // Clear existing options except the first one
    filterWilayah.innerHTML = '<option value="">Semua Wilayah</option>';
    
    // Sort and add regions
    Array.from(regions).sort().forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        filterWilayah.appendChild(option);
    });
}

function setupFilterListeners() {
    const filterNama = document.getElementById('filterNama');
    const filterWilayah = document.getElementById('filterWilayah');
    const btnResetFilter = document.getElementById('btnResetFilter');

    filterNama.addEventListener('input', filterAndBuildDashboard);
    filterWilayah.addEventListener('change', filterAndBuildDashboard);
    
    btnResetFilter.addEventListener('click', () => {
        filterNama.value = '';
        filterWilayah.value = '';
        filterAndBuildDashboard();
    });
}

function filterAndBuildDashboard() {
    const namaQuery = document.getElementById('filterNama').value.toLowerCase().trim();
    const wilayahQuery = document.getElementById('filterWilayah').value;

    const filteredData = allSubmissions.filter(item => {
        const matchNama = !namaQuery || (item.selectedUser?.name || '').toLowerCase().includes(namaQuery);
        const matchWilayah = !wilayahQuery || item.selectedUser?.region === wilayahQuery;
        return matchNama && matchWilayah;
    });

    updateMetrics(filteredData);
    buildAverageTimeChart(filteredData);
    buildTopRolesChart(filteredData);
    buildRegionsChart(filteredData);
    buildMeaningfulChart(filteredData);
    buildSubmissionsTable(filteredData);
}

function updateMetrics(data) {
    const total = data.length;
    
    const regions = new Set();
    const campuses = new Set();
    
    data.forEach(item => {
        if (item.selectedUser?.region) regions.add(item.selectedUser.region);
        if (item.selectedUser?.campus) campuses.add(item.selectedUser.campus);
    });

    document.getElementById('metricTotal').textContent = total;
    document.getElementById('metricWilayah').textContent = regions.size;
    document.getElementById('metricKampus').textContent = campuses.size;
}

// Chart 1: Average Time split over all submissions
function buildAverageTimeChart(data) {
    const categoriesSum = {
        'kerja': 0, 'tidur': 0, 'hiburan': 0, 'organisasi': 0, 'ibadah': 0, 'keluarga': 0, 'lainnya': 0
    };
    
    const categoryLabels = {
        'kerja': 'Kuliah / Kerja', 'tidur': 'Tidur', 'hiburan': 'Hiburan / Sosmed', 'organisasi': 'Organisasi', 'ibadah': 'Ibadah', 'keluarga': 'Keluarga', 'lainnya': 'Lainnya'
    };
    
    const categoryColors = {
        'kerja': '#4d7c0f', 'tidur': '#4b5563', 'hiburan': '#d97706', 'organisasi': '#0284c7', 'ibadah': '#7c3aed', 'keluarga': '#db2777', 'lainnya': '#9ca3af'
    };

    data.forEach(item => {
        const cats = item.timeAudit?.categories || [];
        cats.forEach(cat => {
            if (categoriesSum[cat.id] !== undefined) {
                categoriesSum[cat.id] += cat.hours;
            }
        });
    });

    const count = data.length;
    const labels = [];
    const avgData = [];
    const colors = [];

    Object.keys(categoriesSum).forEach(key => {
        labels.push(categoryLabels[key]);
        avgData.push((categoriesSum[key] / count).toFixed(1));
        colors.push(categoryColors[key]);
    });

    const ctx = document.getElementById('avgTimeChart').getContext('2d');
    if (charts.avgTime) {
        charts.avgTime.destroy();
    }
    charts.avgTime = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: avgData,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: 'var(--card-bg)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: 'var(--text-primary)', font: { family: 'Plus Jakarta Sans', size: 9 } }
                }
            }
        }
    });
}

// Chart 2: Top Roles compiled frequency
function buildTopRolesChart(data) {
    const rolesFreq = {};
    
    data.forEach(item => {
        const roles = item.roles || [];
        roles.forEach(r => {
            rolesFreq[r.name] = (rolesFreq[r.name] || 0) + 1;
        });
    });

    // Sort top roles
    const sorted = Object.entries(rolesFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

    const labels = sorted.map(s => s[0]);
    const counts = sorted.map(s => s[1]);

    const ctx = document.getElementById('topRolesChart').getContext('2d');
    if (charts.topRoles) {
        charts.topRoles.destroy();
    }
    charts.topRoles = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Awardee',
                data: counts,
                backgroundColor: '#1e4636',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { precision: 0, color: 'var(--text-muted)' }, grid: { drawOnChartArea: false } },
                y: { ticks: { color: 'var(--text-primary)' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// Chart 3: Distribution of Regions
function buildRegionsChart(data) {
    const regionFreq = {};
    data.forEach(item => {
        const reg = item.selectedUser?.region || 'Lainnya';
        regionFreq[reg] = (regionFreq[reg] || 0) + 1;
    });

    const labels = Object.keys(regionFreq);
    const counts = Object.values(regionFreq);
    // Custom green-ish tone palette for regions
    const colors = ['#1e4636', '#2d5a27', '#4d7c0f', '#0ca678', '#0284c7', '#7c3aed', '#d97706', '#9ca3af'];

    const ctx = document.getElementById('regionsChart').getContext('2d');
    if (charts.regions) {
        charts.regions.destroy();
    }
    charts.regions = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1,
                borderColor: 'var(--card-bg)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: 'var(--text-primary)', font: { family: 'Plus Jakarta Sans', size: 9 } }
                }
            }
        }
    });
}

// Chart 4: Meaningful Activities frequency
function buildMeaningfulChart(data) {
    const freq = {};
    const categoryLabels = {
        'kerja': 'Kuliah / Kerja', 'tidur': 'Tidur', 'hiburan': 'Hiburan / Sosmed', 'organisasi': 'Organisasi', 'ibadah': 'Ibadah', 'keluarga': 'Keluarga', 'lainnya': 'Lainnya'
    };

    data.forEach(item => {
        const id = item.timeAudit?.mostMeaning;
        if (id) {
            const label = categoryLabels[id] || id;
            freq[label] = (freq[label] || 0) + 1;
        }
    });

    const labels = Object.keys(freq);
    const counts = Object.values(freq);

    const ctx = document.getElementById('meaningfulChart').getContext('2d');
    if (charts.meaningful) {
        charts.meaningful.destroy();
    }
    charts.meaningful = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: '#db2777',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: 'var(--text-primary)' }, grid: { drawOnChartArea: false } },
                y: { ticks: { precision: 0, color: 'var(--text-muted)' }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

// Submissions Table of stories
function buildSubmissionsTable(data) {
    const tableBody = document.getElementById('submissionsTableBody');
    tableBody.innerHTML = '';

    if (!data || data.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Tidak ada data refleksi yang cocok dengan filter pencarian.
            </td>
        `;
        tableBody.appendChild(tr);
        return;
    }

    const categoryLabels = {
        'kerja': 'Kuliah / Kerja', 'tidur': 'Tidur', 'hiburan': 'Hiburan / Sosmed', 'organisasi': 'Organisasi', 'ibadah': 'Ibadah', 'keluarga': 'Keluarga', 'lainnya': 'Lainnya'
    };

    data.forEach(item => {
        const tr = document.createElement('tr');
        
        const mostTimeLabel = categoryLabels[item.timeAudit?.mostTime] || item.timeAudit?.mostTime || '-';
        const mostMeaningLabel = categoryLabels[item.timeAudit?.mostMeaning] || item.timeAudit?.mostMeaning || '-';

        tr.innerHTML = `
            <td>
                <strong>${item.selectedUser?.name || 'Anonim'}</strong><br>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${item.selectedUser?.region || '-'}, ${item.selectedUser?.campus || '-'}</span>
            </td>
            <td>${mostTimeLabel}</td>
            <td>${mostMeaningLabel} ⭐</td>
            <td>
                <div class="story-block">
                    <p><strong>Penerima Dampak:</strong> ${item.contribution?.person || '-'}</p>
                    <p><strong>Kontribusi:</strong> ${item.contribution?.action || '-'}</p>
                    <p><strong>Perubahan:</strong> ${item.contribution?.change || '-'}</p>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}
