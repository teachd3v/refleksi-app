// Application State
const state = {
    currentStep: 0,
    theme: 'light',
    selectedUser: null, // { name, region, campus }
    awardees: [],       // Array of all awardees from CSV
    submissions: [],    // Submitted data loaded from database JSON
    timeAudit: {
        categories: [
            { id: 'kerja', label: 'Kuliah / Kerja', hours: 8, color: '#4d7c0f' },
            { id: 'tidur', label: 'Tidur', hours: 7, color: '#4b5563' },
            { id: 'hiburan', label: 'Hiburan / Sosmed', hours: 3, color: '#d97706' },
            { id: 'organisasi', label: 'Organisasi', hours: 2, color: '#0284c7' },
            { id: 'ibadah', label: 'Ibadah', hours: 1.5, color: '#7c3aed' },
            { id: 'keluarga', label: 'Keluarga', hours: 0.5, color: '#db2777' },
            { id: 'lainnya', label: 'Lainnya', hours: 2, color: '#9ca3af' }
        ],
        mostTime: 'kerja',
        mostMeaning: 'ibadah',
        reflection: ''
    },
    roles: [
        { name: 'Anak', color: 'note-yellow' },
        { name: 'Mahasiswa', color: 'note-orange' },
        { name: 'Awardee', color: 'note-green' },
        { name: 'Ketua Organisasi', color: 'note-pink' },
        { name: 'Mentor', color: 'note-green' },
        { name: 'Teman', color: 'note-blue' }
    ],
    roleReflection: {
        dominant: '',
        heaviest: '',
        neglected: '',
        proud: '',
        text: ''
    },
    contribution: {
        person: '',
        action: '',
        change: ''
    }
};

// DOM Elements
const screens = document.querySelectorAll('.screen');
const stepNodes = document.querySelectorAll('.step-node');
const progressBar = document.getElementById('progressBar');

// Charts references
let timeChart = null;
let summaryTimeChart = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Icons
    lucide.createIcons();
    
    // Set current date
    const summaryDateEl = document.getElementById('summaryDate');
    if (summaryDateEl) {
        const dateOpts = { year: 'numeric', month: 'long', day: 'numeric' };
        summaryDateEl.textContent = new Date().toLocaleDateString('id-ID', dateOpts);
    }

    setupAwardeeSelector();
    setupNavigation();
    setupTimeAudit();
    setupRoles();
    setupChairReflection();
    setupSummaryActions();
    loadDraft();
});

// Awardee searchable dropdown selection
function setupAwardeeSelector() {
    const searchInput = document.getElementById('awardeeSearchInput');
    const optionsList = document.getElementById('searchOptionsList');
    const infoCard = document.getElementById('awardeeInfoCard');
    const infoWilayah = document.getElementById('infoWilayah');
    const infoKampus = document.getElementById('infoKampus');
    const btnStart = document.getElementById('btnStart');

    // Fetch and parse CSV, and load submissions database
    Promise.all([
        fetch('daftar_awardee.csv').then(res => res.text()),
        fetch('/api/submissions').then(res => res.json()).catch(() => [])
    ]).then(([csvText, submissions]) => {
        state.awardees = parseCSV(csvText);
        state.submissions = submissions;
    }).catch(err => {
        console.error('Gagal memuat database awardee & submissions:', err);
    });

    function parseCSV(text) {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const nameIdx = headers.indexOf('Nama Awardee');
        const regionIdx = headers.indexOf('Wilayah');
        const campusIdx = headers.indexOf('Kampus');

        return lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim());
            return {
                name: cols[nameIdx] || '',
                region: cols[regionIdx] || '',
                campus: cols[campusIdx] || ''
            };
        }).filter(item => item.name !== '');
    }

    function renderOptions(filtered) {
        optionsList.innerHTML = '';
        if (filtered.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'search-option-item';
            empty.style.color = 'var(--text-muted)';
            empty.style.cursor = 'default';
            empty.textContent = 'Nama tidak ditemukan';
            optionsList.appendChild(empty);
            return;
        }

        filtered.forEach(item => {
            const hasSubmitted = state.submissions && state.submissions.some(s => s.selectedUser?.name === item.name);

            const option = document.createElement('div');
            option.className = 'search-option-item';
            option.style.display = 'flex';
            option.style.justifyContent = 'space-between';
            option.style.alignItems = 'center';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            option.appendChild(nameSpan);

            if (hasSubmitted) {
                const badge = document.createElement('span');
                badge.className = 'badge-submitted';
                badge.textContent = 'Sudah Mengisi';
                option.appendChild(badge);
            }

            option.addEventListener('click', () => {
                selectAwardee(item);
            });
            optionsList.appendChild(option);
        });
    }

    function selectAwardee(item) {
        state.selectedUser = item;
        searchInput.value = item.name;
        infoWilayah.textContent = item.region;
        infoKampus.textContent = item.campus;
        infoCard.classList.add('active');
        btnStart.removeAttribute('disabled');
        optionsList.classList.remove('show');

        // Check if user has already submitted and pull their data
        const existing = state.submissions && state.submissions.find(s => s.selectedUser?.name === item.name);
        if (existing) {
            // Restore state
            state.timeAudit.categories = existing.timeAudit.categories;
            state.timeAudit.mostTime = existing.timeAudit.mostTime;
            state.timeAudit.mostMeaning = existing.timeAudit.mostMeaning;
            state.roles = existing.roles;
            state.roleReflection = existing.roleReflection;
            state.contribution = existing.contribution;
            
            // Pre-fill inputs
            const selectDominant = document.getElementById('roleDominant');
            if (selectDominant) selectDominant.value = state.roleReflection.dominant;
            const selectHeaviest = document.getElementById('roleHeaviest');
            if (selectHeaviest) selectHeaviest.value = state.roleReflection.heaviest;
            const selectNeglected = document.getElementById('roleNeglected');
            if (selectNeglected) selectNeglected.value = state.roleReflection.neglected;
            const selectProud = document.getElementById('roleProud');
            if (selectProud) selectProud.value = state.roleReflection.proud;

            const chairPerson = document.getElementById('chairPerson');
            if (chairPerson) chairPerson.value = state.contribution.person;
            const chairCont = document.getElementById('chairContribution');
            if (chairCont) chairCont.value = state.contribution.action;
            const chairChange = document.getElementById('chairChange');
            if (chairChange) chairChange.value = state.contribution.change;
            
            // Sync components
            setupTimeAudit();
            setupRoles();
        } else {
            // Reset to defaults if clean user selected
            resetToCleanDefaults();
        }

        saveDraft();
    }

    function resetToCleanDefaults() {
        state.timeAudit.mostTime = 'kerja';
        state.timeAudit.mostMeaning = 'ibadah';
        state.timeAudit.categories = [
            { id: 'kerja', label: 'Kuliah / Kerja', hours: 8, color: '#4d7c0f' },
            { id: 'tidur', label: 'Tidur', hours: 7, color: '#4b5563' },
            { id: 'hiburan', label: 'Hiburan / Sosmed', hours: 3, color: '#d97706' },
            { id: 'organisasi', label: 'Organisasi', hours: 2, color: '#0284c7' },
            { id: 'ibadah', label: 'Ibadah', hours: 1.5, color: '#7c3aed' },
            { id: 'keluarga', label: 'Keluarga', hours: 0.5, color: '#db2777' },
            { id: 'lainnya', label: 'Lainnya', hours: 2, color: '#9ca3af' }
        ];
        state.roles = [
            { name: 'Anak', color: 'note-yellow' },
            { name: 'Mahasiswa', color: 'note-orange' },
            { name: 'Awardee', color: 'note-green' },
            { name: 'Ketua Organisasi', color: 'note-pink' },
            { name: 'Mentor', color: 'note-green' },
            { name: 'Teman', color: 'note-blue' }
        ];
        state.roleReflection = { dominant: '', heaviest: '', neglected: '', proud: '', text: '' };
        state.contribution = { person: '', action: '', change: '' };

        // Reset DOM text inputs
        const selectDominant = document.getElementById('roleDominant');
        if (selectDominant) selectDominant.value = '';
        const selectHeaviest = document.getElementById('roleHeaviest');
        if (selectHeaviest) selectHeaviest.value = '';
        const selectNeglected = document.getElementById('roleNeglected');
        if (selectNeglected) selectNeglected.value = '';
        const selectProud = document.getElementById('roleProud');
        if (selectProud) selectProud.value = '';

        const chairPerson = document.getElementById('chairPerson');
        if (chairPerson) chairPerson.value = '';
        const chairCont = document.getElementById('chairContribution');
        if (chairCont) chairCont.value = '';
        const chairChange = document.getElementById('chairChange');
        if (chairChange) chairChange.value = '';

        setupTimeAudit();
        setupRoles();
    }

    function clearSelection() {
        state.selectedUser = null;
        infoWilayah.textContent = '-';
        infoKampus.textContent = '-';
        infoCard.classList.remove('active');
        btnStart.setAttribute('disabled', 'true');
        saveDraft();
    }

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            clearSelection();
            optionsList.classList.remove('show');
            return;
        }

        const filtered = state.awardees.filter(a => a.name.toLowerCase().includes(query));
        renderOptions(filtered);
        optionsList.classList.add('show');
        
        // Auto select if unique exact match
        const exact = state.awardees.find(a => a.name.toLowerCase() === query);
        if (exact) {
            selectAwardee(exact);
        } else {
            clearSelection();
        }
    });

    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.toLowerCase().trim();
        const filtered = query === '' 
            ? state.awardees 
            : state.awardees.filter(a => a.name.toLowerCase().includes(query));
        renderOptions(filtered);
        optionsList.classList.add('show');
    });

    // Close options list when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !optionsList.contains(e.target)) {
            optionsList.classList.remove('show');
        }
    });
}

// Navigation Logic
function setupNavigation() {
    // Start button
    document.getElementById('btnStart').addEventListener('click', () => {
        goToStep(1);
    });

    // Previous buttons
    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', () => {
            goToStep(state.currentStep - 1);
        });
    });

    // Next buttons
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', () => {
            // Screen specific validations if needed
            if (state.currentStep === 1) {
                // Save inputs
                const maxHoursCat = state.timeAudit.categories.reduce((max, cat) => cat.hours > max.hours ? cat : max, state.timeAudit.categories[0]);
                state.timeAudit.mostTime = maxHoursCat.id;
                state.timeAudit.mostMeaning = document.getElementById('selectMostMeaning').value;
                saveDraft();
            } else if (state.currentStep === 2) {
                // Save role responses
                state.roleReflection.dominant = document.getElementById('roleDominant').value;
                state.roleReflection.heaviest = document.getElementById('roleHeaviest').value;
                state.roleReflection.neglected = document.getElementById('roleNeglected').value;
                state.roleReflection.proud = document.getElementById('roleProud').value;
                saveDraft();
            } else if (state.currentStep === 3) {
                // Save Empty Chair responses
                state.contribution.person = document.getElementById('chairPerson').value;
                state.contribution.action = document.getElementById('chairContribution').value;
                state.contribution.change = document.getElementById('chairChange').value;
                
                // Build summary dashboard
                buildSummaryDashboard();
                submitDataToBackend();
            }
            goToStep(state.currentStep + 1);
        });
    });

    // Directly click step nodes if they are unlocked
    if (stepNodes && stepNodes.length > 0) {
        stepNodes.forEach(node => {
            node.addEventListener('click', () => {
                const stepIndex = parseInt(node.getAttribute('data-step'));
                if (stepIndex <= state.currentStep || !node.hasAttribute('disabled')) {
                    goToStep(stepIndex);
                }
            });
        });
    }
}

function goToStep(stepIndex) {
    state.currentStep = stepIndex;
    
    // Update active screen
    screens.forEach((screen, index) => {
        if (index === stepIndex) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });

    // Update progress tracker nodes & bar
    if (progressBar) {
        const totalSteps = stepNodes.length || 5;
        const percentage = (stepIndex / (totalSteps - 1)) * 100;
        progressBar.style.width = `${percentage}%`;
    }

    if (stepNodes && stepNodes.length > 0) {
        stepNodes.forEach((node, index) => {
            const nodeIndex = parseInt(node.getAttribute('data-step'));
            if (nodeIndex === stepIndex) {
                node.classList.add('active');
                node.classList.remove('completed');
                node.removeAttribute('disabled');
            } else if (nodeIndex < stepIndex) {
                node.classList.remove('active');
                node.classList.add('completed');
                node.removeAttribute('disabled');
            } else {
                node.classList.remove('active');
                node.classList.remove('completed');
                // Allow going back to previous items
                if (nodeIndex > state.currentStep + 1) {
                    node.setAttribute('disabled', 'true');
                } else {
                    node.removeAttribute('disabled');
                }
            }
        });
    }

    // Trigger chart resize if entering charts pages
    if (stepIndex === 1 && timeChart) {
        timeChart.resize();
    }
}

// Time Audit Logic
function setupTimeAudit() {
    const listContainer = document.getElementById('timeInputsList');
    const selectMostMeaning = document.getElementById('selectMostMeaning');
    
    function renderInputs() {
        listContainer.innerHTML = '';
        state.timeAudit.categories.forEach((cat, idx) => {
            const row = document.createElement('div');
            row.className = 'time-row';
            
            row.innerHTML = `
                <span class="time-activity-label">${cat.label}</span>
                <input type="range" min="0" max="24" step="0.5" value="${cat.hours}" data-idx="${idx}" class="time-range-input">
                <input type="number" min="0" max="24" step="0.5" value="${cat.hours}" data-idx="${idx}" class="custom-input time-number-input">
            `;
            listContainer.appendChild(row);
        });

        // Populate selects
        updateHighlightDropdowns();
        
        // Listeners for inputs
        document.querySelectorAll('.time-range-input').forEach(range => {
            range.addEventListener('input', handleTimeChange);
        });
        document.querySelectorAll('.time-number-input').forEach(num => {
            num.addEventListener('change', handleTimeChange);
        });
        
        selectMostMeaning.addEventListener('change', () => {
            state.timeAudit.mostMeaning = selectMostMeaning.value;
            updateTimeChart();
        });

        validateTotalHours();
        initTimeChart();
    }

    function handleTimeChange(e) {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        let val = parseFloat(e.target.value) || 0;
        
        if (val < 0) val = 0;
        if (val > 24) val = 24;

        state.timeAudit.categories[idx].hours = val;
        
        // Synchronize twin input
        const numberInput = listContainer.querySelector(`.time-number-input[data-idx="${idx}"]`);
        const rangeInput = listContainer.querySelector(`.time-range-input[data-idx="${idx}"]`);
        
        if (e.target.classList.contains('time-range-input')) {
            numberInput.value = val;
        } else {
            rangeInput.value = val;
        }

        validateTotalHours();
        updateTimeChart();
    }

    function validateTotalHours() {
        const nextBtn = document.getElementById('btnNextTime');
        if (nextBtn) {
            nextBtn.removeAttribute('disabled');
        }
    }

    function updateHighlightDropdowns() {
        const currentMostMeaning = selectMostMeaning.value || state.timeAudit.mostMeaning;

        selectMostMeaning.innerHTML = '<option value="">Pilih...</option>';

        state.timeAudit.categories.forEach(cat => {
            const opt2 = document.createElement('option');
            opt2.value = cat.id;
            opt2.textContent = `${cat.label}`;
            if (cat.id === currentMostMeaning) opt2.selected = true;
            selectMostMeaning.appendChild(opt2);
        });
    }

    function initTimeChart() {
        const ctx = document.getElementById('timeChart').getContext('2d');
        const currentMostMeaning = selectMostMeaning.value || state.timeAudit.mostMeaning;
        const labels = state.timeAudit.categories.map(c => c.id === currentMostMeaning ? `${c.label} ⭐` : c.label);
        const data = state.timeAudit.categories.map(c => c.hours);
        const colors = state.timeAudit.categories.map(c => c.color);

        if (timeChart) {
            timeChart.destroy();
        }

        timeChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: 'var(--card-bg)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'var(--text-primary)',
                            font: { family: 'Plus Jakarta Sans', size: 11 }
                        }
                    }
                }
            }
        });
    }

    function updateTimeChart() {
        if (!timeChart) return;
        const currentMostMeaning = selectMostMeaning.value || state.timeAudit.mostMeaning;
        timeChart.data.labels = state.timeAudit.categories.map(c => c.id === currentMostMeaning ? `${c.label} ⭐` : c.label);
        timeChart.data.datasets[0].data = state.timeAudit.categories.map(c => c.hours);
        timeChart.update();
        updateHighlightDropdowns();
    }

    renderInputs();
}

// Role Card Logic
function setupRoles() {
    const stickyBoard = document.getElementById('stickyBoard');
    const inputRoleName = document.getElementById('inputRoleName');
    const selectRoleColor = document.getElementById('selectRoleColor');
    const btnAddRole = document.getElementById('btnAddRole');

    function renderStickyNotes() {
        stickyBoard.innerHTML = '';
        state.roles.forEach((role, index) => {
            const note = document.createElement('div');
            note.className = `sticky-note ${role.color}`;
            note.innerHTML = `
                <span class="note-text">${role.name}</span>
                <button class="note-delete" data-index="${index}" title="Hapus"><i data-lucide="trash-2" style="width:16px;height:16px;"></i></button>
            `;
            stickyBoard.appendChild(note);
        });

        lucide.createIcons();

        // Bind delete buttons
        document.querySelectorAll('.note-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                state.roles.splice(idx, 1);
                renderStickyNotes();
                updateRoleDropdowns();
            });
        });

        updateRoleDropdowns();
    }

    function updateRoleDropdowns() {
        const dropdowns = ['roleDominant', 'roleHeaviest', 'roleNeglected', 'roleProud'];
        
        dropdowns.forEach(id => {
            const dropdown = document.getElementById(id);
            const currentValue = dropdown.value;
            dropdown.innerHTML = '<option value="">Pilih...</option>';
            
            state.roles.forEach(role => {
                const opt = document.createElement('option');
                opt.value = role.name;
                opt.textContent = role.name;
                if (role.name === currentValue) opt.selected = true;
                dropdown.appendChild(opt);
            });
        });
    }

    btnAddRole.addEventListener('click', () => {
        const name = inputRoleName.value.trim();
        if (!name) return;

        const color = selectRoleColor.value;
        state.roles.push({ name, color });
        inputRoleName.value = '';
        renderStickyNotes();
    });

    inputRoleName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btnAddRole.click();
        }
    });

    renderStickyNotes();
}

// Chair Reflection Logic
function setupChairReflection() {
    // Simply sync textareas with local state on input
    const inputs = ['chairPerson', 'chairContribution', 'chairChange'];
    inputs.forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            const field = id.replace('chair', '').toLowerCase();
            if (field === 'person') state.contribution.person = e.target.value;
            if (field === 'contribution') state.contribution.action = e.target.value;
            if (field === 'change') state.contribution.change = e.target.value;
        });
    });
}

// Summary Page Setup
function buildSummaryDashboard() {
    // Render selected user metadata at summary header
    const sumHeader = document.querySelector('.summary-header');
    if (sumHeader) {
        let metaUser = document.getElementById('summaryMetaUser');
        if (!metaUser) {
            metaUser = document.createElement('p');
            metaUser.id = 'summaryMetaUser';
            metaUser.className = 'summary-meta-user';
            sumHeader.appendChild(metaUser);
        }
        if (state.selectedUser) {
            metaUser.innerHTML = `<strong>${state.selectedUser.name}</strong> &bull; Wilayah: ${state.selectedUser.region} &bull; Kampus: ${state.selectedUser.campus}`;
        } else {
            metaUser.innerHTML = '';
        }
    }

    // Time audit summary values
    const mostTimeCat = state.timeAudit.categories.find(c => c.id === state.timeAudit.mostTime);
    const mostMeaningCat = state.timeAudit.categories.find(c => c.id === state.timeAudit.mostMeaning);
    
    document.getElementById('sumMostTime').textContent = mostTimeCat ? `${mostTimeCat.label} (${mostTimeCat.hours} jam)` : '-';
    document.getElementById('sumMostMeaning').textContent = mostMeaningCat ? mostMeaningCat.label : '-';

    // Build static doughnut chart for summary page
    const sumCtx = document.getElementById('summaryTimeChart').getContext('2d');
    const labels = state.timeAudit.categories.filter(c => c.hours > 0).map(c => c.label);
    const data = state.timeAudit.categories.filter(c => c.hours > 0).map(c => c.hours);
    const colors = state.timeAudit.categories.filter(c => c.hours > 0).map(c => c.color);

    if (summaryTimeChart) {
        summaryTimeChart.destroy();
    }

    summaryTimeChart = new Chart(sumCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
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
                    labels: {
                        color: 'var(--text-primary)',
                        font: { family: 'Plus Jakarta Sans', size: 10 }
                    }
                }
            }
        }
    });

    // Roles summary list
    const sumRolesList = document.getElementById('sumRolesList');
    sumRolesList.innerHTML = '';
    state.roles.forEach(role => {
        const span = document.createElement('span');
        span.className = `role-tag ${role.color}`;
        span.textContent = role.name;
        sumRolesList.appendChild(span);
    });

    document.getElementById('sumRoleDominant').textContent = state.roleReflection.dominant || '-';
    document.getElementById('sumRoleHeaviest').textContent = state.roleReflection.heaviest || '-';
    document.getElementById('sumRoleNeglected').textContent = state.roleReflection.neglected || '-';
    document.getElementById('sumRoleProud').textContent = state.roleReflection.proud || '-';

    // Chair contribution summary
    document.getElementById('sumChairPerson').textContent = state.contribution.person || 'sesorang';
    document.getElementById('sumChairContribution').textContent = state.contribution.action || '-';
    document.getElementById('sumChairChange').textContent = state.contribution.change || '-';
}

function setupSummaryActions() {
    // Print/PDF export button
    document.getElementById('btnPrint').addEventListener('click', () => {
        window.print();
    });

    // Restart button
    document.getElementById('btnRestart').addEventListener('click', () => {
        // Reset state values
        state.selectedUser = null;
        state.timeAudit.reflection = '';
        state.timeAudit.mostTime = 'kerja';
        state.timeAudit.mostMeaning = 'ibadah';
        
        state.roles = [
            { name: 'Anak', color: 'note-yellow' },
            { name: 'Mahasiswa', color: 'note-orange' },
            { name: 'Awardee', color: 'note-green' },
            { name: 'Ketua Organisasi', color: 'note-pink' },
            { name: 'Mentor', color: 'note-green' },
            { name: 'Teman', color: 'note-blue' }
        ];
        
        state.roleReflection = { dominant: '', heaviest: '', neglected: '', proud: '', text: '' };
        state.contribution = { person: '', action: '', change: '' };

        // Reset DOM text inputs
        const searchInput = document.getElementById('awardeeSearchInput');
        if (searchInput) searchInput.value = '';
        const infoCard = document.getElementById('awardeeInfoCard');
        if (infoCard) infoCard.classList.remove('active');
        const infoWilayah = document.getElementById('infoWilayah');
        if (infoWilayah) infoWilayah.textContent = '-';
        const infoKampus = document.getElementById('infoKampus');
        if (infoKampus) infoKampus.textContent = '-';
        const btnStart = document.getElementById('btnStart');
        if (btnStart) btnStart.setAttribute('disabled', 'true');

        document.getElementById('chairPerson').value = '';
        document.getElementById('chairContribution').value = '';
        document.getElementById('chairChange').value = '';

        // Clear localStorage draft
        localStorage.removeItem('refleksi_draft');

        // Restart components
        setupTimeAudit();
        setupRoles();

        goToStep(0);
    });
}

// LocalStorage Auto-Save & API Submission Functions
function saveDraft() {
    const draft = {
        selectedUser: state.selectedUser,
        timeAudit: {
            categories: state.timeAudit.categories,
            mostTime: state.timeAudit.mostTime,
            mostMeaning: state.timeAudit.mostMeaning
        },
        roles: state.roles,
        roleReflection: state.roleReflection,
        contribution: state.contribution
    };
    localStorage.setItem('refleksi_draft', JSON.stringify(draft));
}

function loadDraft() {
    const draftStr = localStorage.getItem('refleksi_draft');
    if (!draftStr) return;
    try {
        const draft = JSON.parse(draftStr);
        if (draft.selectedUser) {
            state.selectedUser = draft.selectedUser;
            const searchInput = document.getElementById('awardeeSearchInput');
            if (searchInput) searchInput.value = state.selectedUser.name;
            const infoCard = document.getElementById('awardeeInfoCard');
            if (infoCard) infoCard.classList.add('active');
            const infoWilayah = document.getElementById('infoWilayah');
            if (infoWilayah) infoWilayah.textContent = state.selectedUser.region;
            const infoKampus = document.getElementById('infoKampus');
            if (infoKampus) infoKampus.textContent = state.selectedUser.campus;
            const btnStart = document.getElementById('btnStart');
            if (btnStart) btnStart.removeAttribute('disabled');
        }
        if (draft.timeAudit) {
            state.timeAudit.categories = draft.timeAudit.categories;
            state.timeAudit.mostTime = draft.timeAudit.mostTime;
            state.timeAudit.mostMeaning = draft.timeAudit.mostMeaning;
        }
        if (draft.roles) {
            state.roles = draft.roles;
        }
        if (draft.roleReflection) {
            state.roleReflection = draft.roleReflection;
            const selectDominant = document.getElementById('roleDominant');
            if (selectDominant) selectDominant.value = state.roleReflection.dominant;
            const selectHeaviest = document.getElementById('roleHeaviest');
            if (selectHeaviest) selectHeaviest.value = state.roleReflection.heaviest;
            const selectNeglected = document.getElementById('roleNeglected');
            if (selectNeglected) selectNeglected.value = state.roleReflection.neglected;
            const selectProud = document.getElementById('roleProud');
            if (selectProud) selectProud.value = state.roleReflection.proud;
        }
        if (draft.contribution) {
            state.contribution = draft.contribution;
            const chairPerson = document.getElementById('chairPerson');
            if (chairPerson) chairPerson.value = state.contribution.person;
            const chairCont = document.getElementById('chairContribution');
            if (chairCont) chairCont.value = state.contribution.action;
            const chairChange = document.getElementById('chairChange');
            if (chairChange) chairChange.value = state.contribution.change;
        }
        
        // Re-render sub-components if state restored
        setupTimeAudit();
        setupRoles();
    } catch(e) {
        console.error('Gagal memuat draf:', e);
    }
}

function submitDataToBackend() {
    fetch('/api/submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            selectedUser: state.selectedUser,
            timeAudit: {
                categories: state.timeAudit.categories,
                mostTime: state.timeAudit.mostTime,
                mostMeaning: state.timeAudit.mostMeaning
            },
            roles: state.roles,
            roleReflection: state.roleReflection,
            contribution: state.contribution
        })
    })
    .then(res => res.json())
    .then(data => {
        console.log('Submission success:', data);
        localStorage.removeItem('refleksi_draft');
    })
    .catch(err => {
        console.error('Failed to submit data to backend:', err);
    });
}
