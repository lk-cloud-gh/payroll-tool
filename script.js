document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// --- STATE ---
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let payrollData = [];
let pieChartInstance = null;
let barChartInstance = null;

// Settings object for storing rates
let settings = {
    hourlyRate: 100, // Default value
    otRate: 150      // Default value
};

// --- HELPER FUNCTION: Get all days in the current month ---
function getDaysInMonth(month, year) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthDataMap = new Map();

    // 1. Map existing payroll data for fast lookup
    payrollData.forEach(entry => {
        const entryDate = new Date(entry.date);
        if (entryDate.getMonth() === month && entryDate.getFullYear() === year) {
            monthDataMap.set(entry.date, entry);
        }
    });

    // 2. Create a list of ALL days and populate with data or empty values
    const allDays = [];
    for (let day = 1; day <= daysInMonth; day++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const entry = monthDataMap.get(dateString) || {
            date: dateString,
            workHr: 0,
            otHr: 0,
            extra: 0,
            remark: ''
        };
        allDays.push(entry);
    }
    return allDays;
}

// --- INITIALIZATION ---
function initializeApp() {
    loadData();
    loadSettings(); // Load saved rates
    renderAll();
    setupEventListeners();
}

function renderAll() {
    renderCalendar(currentMonth, currentYear);
    renderTotalBalance();
    renderCharts();
    renderStatementTable(); 
}

// --- DATA & SETTINGS HANDLING (LocalStorage) ---
function loadData() {
    const data = localStorage.getItem('payrollData');
    payrollData = data ? JSON.parse(data) : [];
}

function saveData() {
    localStorage.setItem('payrollData', JSON.stringify(payrollData));
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('payrollSettings');
    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    }
    // Update the input fields with the loaded or default values
    document.getElementById('hourly-rate-input').value = settings.hourlyRate;
    document.getElementById('ot-rate-input').value = settings.otRate;
}

// Save settings to localStorage
function saveSettings() {
    // Read values from the input fields
    settings.hourlyRate = parseFloat(document.getElementById('hourly-rate-input').value) || 0;
    settings.otRate = parseFloat(document.getElementById('ot-rate-input').value) || 0;
    
    localStorage.setItem('payrollSettings', JSON.stringify(settings));
    
    // After saving, we must re-render everything to reflect the new rates
    renderAll(); 
}


// --- RENDER FUNCTIONS ---
function renderCalendar(month, year) {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('current-month-year');
    calendarGrid.innerHTML = ''; // Clear previous calendar

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    monthYearDisplay.textContent = `${new Date(year, month).toLocaleString('en-US', { month: 'long' })} ${year}`;

    // Add weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    weekdays.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.textContent = day;
        dayEl.style.fontWeight = 'bold';
        calendarGrid.appendChild(dayEl);
    });

    // Add blank days for first week alignment
    for (let i = 0; i < firstDay; i++) {
        calendarGrid.appendChild(document.createElement('div'));
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.classList.add('calendar-day');
        dayEl.textContent = day;
        const currentDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayEl.dataset.date = currentDate;

        // Use payrollData directly here as we only need to check for existence
        const entry = payrollData.find(e => e.date === currentDate);
        if (entry) {
            if (entry.workHr > 0 || entry.otHr > 0 || entry.extra > 0) {
                dayEl.classList.add('has-entry');
                const dailyIncome = (entry.workHr * settings.hourlyRate) + (entry.otHr * settings.otRate) + (entry.extra || 0);
                const incomeEl = document.createElement('div');
                incomeEl.classList.add('day-income');
                incomeEl.textContent = `฿${dailyIncome.toFixed(0)}`;
                dayEl.appendChild(incomeEl);
            }
            
            // Add golden border if remark exists
            if (entry.remark && entry.remark.trim() !== '') {
                dayEl.classList.add('has-remark');
            }
        }
        
        dayEl.addEventListener('click', () => openEntryModal(currentDate));
        calendarGrid.appendChild(dayEl);
    }
}

function renderTotalBalance() {
    const balanceEl = document.getElementById('total-balance');
    const monthEntries = payrollData.filter(e => {
        const entryDate = new Date(e.date);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });
    
    const total = monthEntries.reduce((sum, entry) => {
        return sum + (entry.workHr * settings.hourlyRate) + (entry.otHr * settings.otRate) + (entry.extra || 0);
    }, 0);

    balanceEl.textContent = `฿${total.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

/**
 * Renders the charts, including the bar chart with all dates and rotated labels.
 */
function renderCharts() {
    // --- PIE CHART (unchanged) ---
    if (pieChartInstance) {
        pieChartInstance.destroy();
        pieChartInstance = null;
    }
    
    const pieContainer = document.getElementById('hoursPieChartContainer');
    let pieCanvas = document.createElement('canvas');
    pieCanvas.id = 'hoursPieChart';
    
    pieContainer.innerHTML = '';
    pieContainer.appendChild(pieCanvas);

    const totalWorkHr = payrollData.reduce((sum, e) => sum + e.workHr, 0);
    const totalOtHr = payrollData.reduce((sum, e) => sum + e.otHr, 0);

    const pieCtx = pieCanvas.getContext('2d');
    pieChartInstance = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: ['Work Hours', 'OT Hours'],
            datasets: [{
                data: [totalWorkHr, totalOtHr],
                backgroundColor: ['#2cc5b1', '#58a6ff'],
                borderColor: '#1c2128',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });

    // --- BAR CHART (Fixed: autoSkip: false) ---
    if (barChartInstance) {
        barChartInstance.destroy();
        barChartInstance = null;
    }

    const barContainer = document.getElementById('incomeBarChartContainer');
    let barCanvas = document.createElement('canvas');
    barCanvas.id = 'incomeBarChart';
    
    barContainer.innerHTML = '';
    barContainer.appendChild(barCanvas);

    // Use the helper function to get all month data
    const monthData = getDaysInMonth(currentMonth, currentYear); 

    // Define custom colors based on remarks
    const regularColors = monthData.map(e => 
        e.remark && e.remark.trim() !== '' ? '#ffc107' : '#2cc5b1'
    );
    const otColors = monthData.map(e => 
        e.remark && e.remark.trim() !== '' ? '#ffd700' : '#58a6ff'
    );

    const barCtx = barCanvas.getContext('2d');
    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            // X-axis labels show every day of the month
            labels: monthData.map(e => new Date(e.date).getDate()), 
            datasets: [
                {
                    label: 'Regular Pay',
                    data: monthData.map(e => e.workHr * settings.hourlyRate), 
                    backgroundColor: regularColors,
                },
                {
                    label: 'OT Pay',
                    data: monthData.map(e => e.otHr * settings.otRate),
                    backgroundColor: otColors,
                }
            ]
        },
        options: {
            scales: { 
                x: { 
                    stacked: true,
                    type: 'category', 
                    title: { display: true, text: 'Day of Month' },
                    ticks: {
                        // FIX: Explicitly disable auto-skipping to show all dates
                        autoSkip: false, 
                        maxRotation: 90,
                        minRotation: 90,
                        align: 'end' 
                    }
                }, 
                y: { 
                    stacked: true 
                } 
            },
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}


/**
 * RENDER STATEMENT TABLE (shows all days in month and highlights rows with remarks)
 */
function renderStatementTable() {
    const tableBody = document.querySelector('#payroll-statement-table tbody');
    const totalRegularPayEl = document.getElementById('total-regular-pay');
    const totalOtPayEl = document.getElementById('total-ot-pay');
    const totalExtraPayEl = document.getElementById('total-extra-pay');
    const totalTotalEl = document.getElementById('statement-total-row').querySelector('#total-total');

    tableBody.innerHTML = ''; // Clear previous rows

    // Use the helper function to get all month data
    const monthEntries = getDaysInMonth(currentMonth, currentYear);

    // Track separate totals
    let totalRegularPay = 0;
    let totalOTPay = 0;
    let totalExtraPay = 0;
    let grandTotal = 0;

    monthEntries.forEach(entry => {
        const workHr = entry.workHr || 0;
        const otHr = entry.otHr || 0;
        const extraPay = entry.extra || 0;
        
        const regularPay = workHr * settings.hourlyRate;
        const otPay = otHr * settings.otRate;
        const dailyTotal = regularPay + otPay + extraPay;

        // Accumulate totals
        totalRegularPay += regularPay;
        totalOTPay += otPay;
        totalExtraPay += extraPay;
        grandTotal += dailyTotal;

        const row = tableBody.insertRow();
        
        // Add highlight class to the row if remark exists
        if (entry.remark && entry.remark.trim() !== '') {
            row.classList.add('remark-highlight');
        }

        // 1. วันที่
        const dateCell = row.insertCell();
        dateCell.textContent = new Date(entry.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' });

        // 2. ชั่วโมงปกติ
        row.insertCell().textContent = workHr.toFixed(1);

        // 3. ชั่วโมงโอที
        row.insertCell().textContent = otHr.toFixed(1);

        // 4. ค่าชม.ปกติ
        row.insertCell().textContent = regularPay.toLocaleString(undefined, { minimumFractionDigits: 2 });

        // 5. ค่าชม.โอที
        row.insertCell().textContent = otPay.toLocaleString(undefined, { minimumFractionDigits: 2 });

        // 6. ค่ากะดึก
        row.insertCell().textContent = extraPay.toLocaleString(undefined, { minimumFractionDigits: 2 });

        // 7. รวม (Daily Total)
        const dailyTotalCell = row.insertCell();
        dailyTotalCell.textContent = dailyTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
        dailyTotalCell.style.fontWeight = 'bold'; 
    });

    // Update summation row (FOOTER)
    totalRegularPayEl.textContent = totalRegularPay.toLocaleString(undefined, { minimumFractionDigits: 2 });
    totalOtPayEl.textContent = totalOTPay.toLocaleString(undefined, { minimumFractionDigits: 2 });
    totalExtraPayEl.textContent = totalExtraPay.toLocaleString(undefined, { minimumFractionDigits: 2 });
    totalTotalEl.textContent = grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 });
}


/**
 * FIX: Function to capture and download the statement table as an image without cropping.
 */
function downloadStatementAsImage() {
    const container = document.querySelector('.statement-container');
    const downloadBtn = document.getElementById('download-statement-btn');
    const mainElement = document.querySelector('main'); 
    
    // 1. Temporarily hide the button
    downloadBtn.style.display = 'none';

    // 2. Save original styles and apply temporary fix for full-width capture (The Fix)
    const originalMainPadding = mainElement.style.padding;
    const originalMainOverflow = mainElement.style.overflow;
    const originalContainerWidth = container.style.width;
    
    // Crucial step: Remove main padding, force overflow to visible, and set container width to match its content
    mainElement.style.padding = '0';
    mainElement.style.overflow = 'visible'; 
    container.style.width = 'max-content';

    // Check for library
    if (typeof html2canvas === 'undefined') {
        alert("The html2canvas library is not loaded. Cannot generate image.");
        // Restore styles
        downloadBtn.style.display = 'block';
        mainElement.style.padding = originalMainPadding;
        mainElement.style.overflow = originalMainOverflow;
        container.style.width = originalContainerWidth; 
        return;
    }

    html2canvas(container, {
        scale: 2, // Increase scale for higher resolution
        allowTaint: true,
        useCORS: true 
    }).then(canvas => {
        // 3. Restore original CSS properties
        downloadBtn.style.display = 'block';
        mainElement.style.padding = originalMainPadding;
        mainElement.style.overflow = originalMainOverflow;
        container.style.width = originalContainerWidth; 

        // 4. Trigger download
        const imageURL = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        const monthYear = new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        a.href = imageURL;
        a.download = `Payroll_Statement_${monthYear}.png`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }).catch(error => {
        console.error("Error generating image:", error);
        // 5. Ensure restoration on error
        downloadBtn.style.display = 'block';
        mainElement.style.padding = originalMainPadding;
        mainElement.style.overflow = originalMainOverflow;
        container.style.width = originalContainerWidth; 
        alert('Could not generate image. See console for details.');
    });
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Tab navigation
    document.querySelector('.bottom-nav').addEventListener('click', (e) => {
        if (e.target.classList.contains('nav-btn')) {
            const tabId = e.target.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            e.target.classList.add('active');
        }
    });

    // Calendar navigation
    document.getElementById('prev-month-btn').addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderAll();
    });
    document.getElementById('next-month-btn').addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderAll();
    });
    
    // Modal form submission and closing
    document.getElementById('entry-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('close-modal-btn').addEventListener('click', () => document.getElementById('entry-modal').style.display = 'none');
    document.getElementById('delete-btn').addEventListener('click', handleDelete);

    // Listen for changes on the rate input fields
    document.getElementById('hourly-rate-input').addEventListener('change', saveSettings);
    document.getElementById('ot-rate-input').addEventListener('change', saveSettings);
    
    // Download button listener
    document.getElementById('download-statement-btn').addEventListener('click', downloadStatementAsImage);
}

// --- MODAL & FORM LOGIC ---
function openEntryModal(date) {
    const modal = document.getElementById('entry-modal');
    const form = document.getElementById('entry-form');
    const dateInput = document.getElementById('entry-date');
    const deleteBtn = document.getElementById('delete-btn');
    
    form.reset();
    dateInput.value = date;
    document.getElementById('modal-title').textContent = `Entry for ${date}`;

    const existingEntry = payrollData.find(e => e.date === date);
    if (existingEntry) {
        document.getElementById('work-hr').value = existingEntry.workHr || 0;
        document.getElementById('ot-hr').value = existingEntry.otHr || 0;
        document.getElementById('extra').value = existingEntry.extra || 0;
        document.getElementById('remark').value = existingEntry.remark || '';
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
        // Set default 0 values for new entries
        document.getElementById('work-hr').value = 0;
        document.getElementById('ot-hr').value = 0;
        document.getElementById('extra').value = 0;
    }

    modal.style.display = 'flex';
}

function handleFormSubmit(e) {
    e.preventDefault();
    const date = document.getElementById('entry-date').value;
    const newEntry = {
        date: date,
        workHr: parseFloat(document.getElementById('work-hr').value) || 0,
        otHr: parseFloat(document.getElementById('ot-hr').value) || 0,
        extra: parseFloat(document.getElementById('extra').value) || 0,
        remark: document.getElementById('remark').value
    };

    const existingIndex = payrollData.findIndex(e => e.date === date);
    if (existingIndex > -1) {
        payrollData[existingIndex] = newEntry;
    } else {
        payrollData.push(newEntry);
    }
    
    saveData();
    renderAll();
    document.getElementById('entry-modal').style.display = 'none';
}

function handleDelete() {
    const date = document.getElementById('entry-date').value;
    payrollData = payrollData.filter(e => e.date !== date);
    saveData();
    renderAll();
    document.getElementById('entry-modal').style.display = 'none';
}