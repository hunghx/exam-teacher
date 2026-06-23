/* ============================================
   SCORING APP - LOGIC
   ============================================ */

// =============================================
// CONFIG - GOOGLE SHEET
// =============================================
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwOiSL0MaTr1mJSERNr9Bf701n32bVJNz-w2PyYp434WnlqKGhWcBiZduVsd1H-744Y/exec';

// =============================================
// DATA
// =============================================
const GROUP_MAX = { 1: 25, 2: 20, 3: 10, 4: 15, 5: 10, 6: 10, 7: 10 };

let schedules = [];

let currentData = {
    reviewerName: '',
    reviewerPhone: '',
    scheduleName: '',
    name: '', // lecturer name
    lesson: '',
    scores: {},
    comment: '',
    total: 0,
    grade: '',
    rowIndex: null,
    timestamp: ''
};

let isEditMode = false;

// =============================================
// DOM
// =============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screenLogin = $('#screenLogin');
const screenScoring = $('#screenScoring');
const screenResult = $('#screenResult');
const loginForm = $('#loginForm');
const scoringForm = $('#scoringForm');
const loadingOverlay = $('#loadingOverlay');

const scheduleSelect = $('#scheduleSelect');
const lecturerSelect = $('#lecturerSelect');
const lessonNameInput = $('#lessonName');

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initSliders();
    initEventListeners();
    loadSchedules();
});

async function loadSchedules() {
    if (!GOOGLE_SHEET_URL) return;
    try {
        scheduleSelect.innerHTML = '<option value="" disabled selected>Đang tải dữ liệu...</option>';
        const res = await fetch(`${GOOGLE_SHEET_URL}?action=get_schedules`, { redirect: 'follow' });
        const data = await res.json();
        if (data.status === 'success') {
            schedules = data.data || [];
            populateSchedules();
        } else {
            scheduleSelect.innerHTML = '<option value="" disabled selected>Lỗi tải dữ liệu</option>';
        }
    } catch (err) {
        console.error(err);
        scheduleSelect.innerHTML = '<option value="" disabled selected>Lỗi kết nối</option>';
    }
}

// =============================================
// PARTICLES
// =============================================
function createParticles() {
    const container = $('#bgParticles');
    const colors = ['#a5b4fc', '#c4b5fd', '#93c5fd', '#d8b4fe', '#7dd3fc'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 6 + 2;
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${Math.random() * 100}%;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            animation-duration: ${Math.random() * 20 + 15}s;
            animation-delay: ${Math.random() * 10}s;
        `;
        container.appendChild(particle);
    }
}

// =============================================
// SLIDERS
// =============================================
function initSliders() {
    $$('.slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const criteriaId = e.target.dataset.criteria;
            const val = parseFloat(e.target.value);
            $(`#val${criteriaId}`).textContent = val;

            const pct = (val / 5) * 100;
            e.target.style.background = `linear-gradient(90deg, #6366f1 0%, #a78bfa ${pct}%, #e2e8f0 ${pct}%)`;

            updateScores();
        });

        slider.style.background = `linear-gradient(90deg, #6366f1 0%, #a78bfa 0%, #e2e8f0 0%)`;
    });
}

function updateScores() {
    let total = 0;
    const groupScores = {};

    $$('.slider').forEach(slider => {
        const val = parseFloat(slider.value);
        const criteriaId = slider.dataset.criteria;
        const groupId = slider.closest('.criteria-item').dataset.groupId;

        currentData.scores[criteriaId] = val;
        total += val;

        if (!groupScores[groupId]) groupScores[groupId] = 0;
        groupScores[groupId] += val;
    });

    for (const [gid, score] of Object.entries(groupScores)) {
        const maxScore = GROUP_MAX[gid];
        $(`#groupScore${gid}`).textContent = score;
        $(`#groupProgress${gid}`).style.width = `${(score / maxScore) * 100}%`;
    }

    currentData.total = total;
    $('#totalScore').textContent = total;

    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (total / 100) * circumference;
    $('#scoreRing').style.strokeDashoffset = offset;

    const ring = $('#scoreRing');
    if (total >= 90) {
        ring.style.stroke = '#10b981';
    } else if (total >= 80) {
        ring.style.stroke = '#6366f1';
    } else if (total >= 70) {
        ring.style.stroke = '#f59e0b';
    } else if (total >= 60) {
        ring.style.stroke = '#f97316';
    } else {
        ring.style.stroke = '#ef4444';
    }
}

// =============================================
// POPULATE DROPDOWNS
// =============================================
function populateSchedules() {
    // Reset option đầu tiên về mặc định
    scheduleSelect.options[0].textContent = '-- Chọn lịch đánh giá --';

    while (scheduleSelect.options.length > 1) {
        scheduleSelect.remove(1);
    }

    if (schedules.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Chưa có lịch đánh giá nào";
        option.disabled = true;
        scheduleSelect.appendChild(option);
        return;
    }

    schedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = `${schedule.name} - ${formatDate(schedule.date)}`;
        scheduleSelect.appendChild(option);
    });
}

function populateLecturers(scheduleId) {
    while (lecturerSelect.options.length > 1) {
        lecturerSelect.remove(1);
    }
    lessonNameInput.value = '';

    if (!scheduleId) {
        lecturerSelect.disabled = true;
        return;
    }

    const schedule = schedules.find(s => String(s.id) === String(scheduleId));
    if (!schedule || !schedule.lecturers || schedule.lecturers.length === 0) {
        lecturerSelect.disabled = true;
        return;
    }

    lecturerSelect.disabled = false;
    schedule.lecturers.forEach((gv, idx) => {
        const option = document.createElement('option');
        option.value = idx;
        option.textContent = gv.name;
        option.dataset.lesson = gv.lesson;
        lecturerSelect.appendChild(option);
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) { }

    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

// =============================================
// EVENTS
// =============================================
function initEventListeners() {

    // On schedule selected
    scheduleSelect.addEventListener('change', (e) => {
        populateLecturers(e.target.value);
    });

    // On lecturer selected
    lecturerSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        lessonNameInput.value = selectedOption.dataset.lesson || '';
    });

    // Login form submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const scheduleId = scheduleSelect.value;
        const schedule = schedules.find(s => String(s.id) === String(scheduleId));
        if (!schedule) return;

        const revName = $('#reviewerName').value.trim();
        const revPhone = $('#reviewerPhone').value.trim();

        const lecturerIdx = lecturerSelect.value;
        const lecturer = schedule.lecturers[lecturerIdx];
        if (!lecturer) return;

        currentData.reviewerName = revName;
        currentData.reviewerPhone = revPhone;
        currentData.scheduleName = schedule.name;
        currentData.name = lecturer.name;
        currentData.lesson = lecturer.lesson;

        $('#displayName').textContent = lecturer.name;
        $('#displayLesson').textContent = lecturer.lesson;

        switchScreen(screenScoring);
    });

    // Scoring form submit
    scoringForm.addEventListener('submit', (e) => {
        e.preventDefault();
        currentData.comment = $('#comment').value.trim();
        currentData.grade = getGrade(currentData.total);
        currentData.timestamp = new Date().toLocaleString('vi-VN');

        submitToGoogleSheet();
    });

    // Back button
    $('#btnBack').addEventListener('click', () => {
        switchScreen(screenLogin);
    });

    // Edit button
    $('#btnEdit').addEventListener('click', () => {
        isEditMode = true;
        switchScreen(screenScoring);
        $('#btnSubmit span').textContent = 'Cập nhật kết quả';
    });

    // New scoring button
    $('#btnNew').addEventListener('click', () => {
        resetForm();
        switchScreen(screenLogin);
    });
}

// =============================================
// SCREEN SWITCH
// =============================================
function switchScreen(target) {
    $$('.screen').forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// GRADING
// =============================================
function getGrade(score) {
    if (score >= 90) return 'Xuất sắc';
    if (score >= 80) return 'Giỏi';
    if (score >= 70) return 'Khá';
    if (score >= 60) return 'Trung bình';
    return 'Không đạt';
}

// =============================================
// GOOGLE SHEET SUBMIT
// =============================================
async function submitToGoogleSheet() {
    showLoading(true);

    const payload = {
        type: 'result', // Add type to identify what to save
        action: isEditMode ? 'update' : 'insert',
        rowIndex: currentData.rowIndex,
        data: {
            timestamp: currentData.timestamp,
            name: currentData.name, // Tên giảng viên
            phone: currentData.reviewerPhone, // SĐT người chấm
            lesson: currentData.lesson,
            reviewerName: currentData.reviewerName,
            scheduleName: currentData.scheduleName,

            score1: currentData.scores[1] || 0,
            score2: currentData.scores[2] || 0,
            score3: currentData.scores[3] || 0,
            score4: currentData.scores[4] || 0,
            score5: currentData.scores[5] || 0,
            score6: currentData.scores[6] || 0,
            score7: currentData.scores[7] || 0,
            score8: currentData.scores[8] || 0,
            score9: currentData.scores[9] || 0,
            score10: currentData.scores[10] || 0,
            score11: currentData.scores[11] || 0,
            score12: currentData.scores[12] || 0,
            score13: currentData.scores[13] || 0,
            score14: currentData.scores[14] || 0,
            score15: currentData.scores[15] || 0,
            score16: currentData.scores[16] || 0,
            score17: currentData.scores[17] || 0,
            score18: currentData.scores[18] || 0,
            score19: currentData.scores[19] || 0,
            score20: currentData.scores[20] || 0,
            total: currentData.total,
            comment: `[Người chấm: ${currentData.reviewerName} | Lịch: ${currentData.scheduleName}]\n${currentData.comment}`
        }
    };

    if (!GOOGLE_SHEET_URL) {
        console.warn('Google Sheet URL chưa được cấu hình.');
        showLoading(false);
        showToast('Chưa cấu hình Google Sheet URL', true);
        return;
    }

    try {
        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow'
        });

        const result = await response.json();
        console.log('✅ Google Sheet response:', result);

        if (result.status === 'success' || result.status === 'updated') {
            if (!isEditMode) {
                currentData.rowIndex = result.row || Date.now();
            }
            showLoading(false);
            showResult();
            showToast(isEditMode
                ? `✅ Đã cập nhật dòng ${result.row} trên Sheet!`
                : `✅ Đã lưu vào Sheet dòng ${result.row}!`
            );
        } else {
            throw new Error(result.message || 'Unknown error');
        }

        isEditMode = false;
        $('#btnSubmit span').textContent = 'Gửi kết quả';

    } catch (err) {
        showLoading(false);
        console.error('❌ Submit error:', err);
        showToast('⚠️ Không kết nối được tới Sheet. Vui lòng thử lại.', true);
    }
}

// Test kết nối Google Sheet (gọi từ Console: testConnection())
async function testConnection() {
    if (!GOOGLE_SHEET_URL) {
        console.log('❌ Chưa cấu hình GOOGLE_SHEET_URL');
        return;
    }
    console.log('🔄 Đang test kết nối Google Sheet...');
    try {
        const res = await fetch(GOOGLE_SHEET_URL, { redirect: 'follow' });
        const text = await res.text();
        console.log('✅ Kết nối thành công! Response:', text);
        showToast('✅ Kết nối Google Sheet OK!');
    } catch (err) {
        console.error('❌ Kết nối thất bại:', err);
        showToast('❌ Không kết nối được Google Sheet', true);
    }
}

// =============================================
// SHOW RESULT
// =============================================
function showResult() {
    $('#resultName').textContent = currentData.name;
    $('#resultLesson').textContent = currentData.lesson;
    $('#resultScore').textContent = `${currentData.total} / 100`;

    const icon = $('#resultIcon');
    icon.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    $('#resultTitle').textContent = 'Đã gửi thành công!';

    if (!GOOGLE_SHEET_URL) {
        $('#resultSubtitle').textContent = 'Kết quả đã lưu cục bộ (chưa kết nối Google Sheet)';
    } else {
        $('#resultSubtitle').textContent = 'Kết quả đã được lưu vào Google Sheet';
    }

    switchScreen(screenResult);
}

// =============================================
// RESET FORM
// =============================================
function resetForm() {
    const oldSchedule = scheduleSelect.value;
    const oldName = $('#reviewerName').value;
    const oldPhone = $('#reviewerPhone').value;

    loginForm.reset();
    scoringForm.reset();
    $('#comment').value = '';

    $$('.slider').forEach(slider => {
        slider.value = 0;
        slider.style.background = `linear-gradient(90deg, #6366f1 0%, #a78bfa 0%, #e2e8f0 0%)`;
        const id = slider.dataset.criteria;
        $(`#val${id}`).textContent = '0';
    });

    for (let i = 1; i <= 7; i++) {
        $(`#groupScore${i}`).textContent = '0';
        $(`#groupProgress${i}`).style.width = '0%';
    }

    $('#totalScore').textContent = '0';
    $('#scoreRing').style.strokeDashoffset = 2 * Math.PI * 52;

    currentData = {
        reviewerName: '',
        reviewerPhone: '',
        scheduleName: '',
        name: '',
        lesson: '',
        scores: {},
        comment: '',
        total: 0,
        grade: '',
        rowIndex: null,
        timestamp: ''
    };

    // Restore reviewer info
    scheduleSelect.value = oldSchedule;
    if (oldSchedule) populateLecturers(oldSchedule);
    $('#reviewerName').value = oldName;
    $('#reviewerPhone').value = oldPhone;

    isEditMode = false;
    $('#btnSubmit span').textContent = 'Gửi kết quả';
}

// =============================================
// UI HELPERS
// =============================================
function showLoading(show) {
    loadingOverlay.classList.toggle('active', show);
}

function showToast(message, isError = false) {
    const toast = $('#toast');
    const toastMsg = $('#toastMsg');

    toastMsg.textContent = message;
    toast.classList.toggle('error', isError);
    toast.querySelector('.toast-icon').textContent = isError ? '✕' : '✓';

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}
