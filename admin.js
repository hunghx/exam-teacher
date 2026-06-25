const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Data
let schedules = [];
let currentScheduleId = null;
let currentGvList = [];
let currentCommitteeList = [];
let allResults = [];
let groupedResults = {};

// API Config
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwig14XC29o1wdv0feNuZCiT7HRVQq9rwChgdFacy4xhrWenVZC1f69PBrcJTiio1x8/exec';

// DOM Elements
const tabBtns = $$('.nav-item');
const tabContents = $$('.tab-content');
const schedulesGrid = $('#schedulesGrid');
const emptySchedules = $('#emptySchedules');
const scheduleForm = $('#scheduleForm');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initEvents();
    loadSchedules();
    showWelcomeGuide();
});

async function showWelcomeGuide() {
    if (localStorage.getItem('admin_visited')) return;
    localStorage.setItem('admin_visited', 'true');

    // Đợi một chút cho UI load xong
    await new Promise(r => setTimeout(r, 1000));
    showToast('👋 Chào mừng đến với trang Admin!', false);

    await new Promise(r => setTimeout(r, 4000));
    showToast('📝 Bước 1: Nhấn "Tạo lịch mới" để thêm ca đánh giá', false);

    await new Promise(r => setTimeout(r, 4000));
    showToast('👨‍🏫 Bước 2: Điền thông tin và thêm danh sách giảng viên', false);

    await new Promise(r => setTimeout(r, 4000));
    showToast('📊 Bước 3: Xem kết quả trên Google Sheet bất cứ lúc nào', false);
}

async function loadSchedules() {
    if (!GOOGLE_SHEET_URL) return;
    try {
        const container = $('#schedulesContainer');
        if (container) container.style.display = 'none';
        $('#schedulesGrid').style.display = 'none';
        $('#emptySchedules').innerHTML = '<p>Đang tải dữ liệu từ Google Sheet...</p>';
        $('#emptySchedules').style.display = 'block';

        const res = await fetch(`${GOOGLE_SHEET_URL}?action=get_schedules`, { redirect: 'follow' });
        const data = await res.json();

        if (data.status === 'success') {
            schedules = data.data || [];
            schedules.forEach(s => {
                s.startTime = formatTime(s.startTime);
                s.endTime = formatTime(s.endTime);
            });
            renderSchedules();
        } else {
            showToast('Lỗi tải dữ liệu', true);
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi kết nối', true);
    }
}

function createParticles() {
    const container = $('#bgParticles');
    const colors = ['#a5b4fc', '#c4b5fd', '#93c5fd', '#d8b4fe', '#7dd3fc'];

    for (let i = 0; i < 20; i++) {
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

function initEvents() {
    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.tab;
            if (tabId === 'create') resetForm();
            if (tabId === 'results') loadResults();
            switchTab(tabId);
        });
    });

    // Close Modal
    $('#btnCloseModal').addEventListener('click', closeModal);
    $('#resultModal').addEventListener('click', (e) => {
        if (e.target === $('#resultModal')) closeModal();
    });

    // On select schedule in Results tab
    $('#resultScheduleSelect').addEventListener('change', (e) => {
        renderResultsForSchedule(e.target.value);
    });

    $('#btnNewSchedule').addEventListener('click', () => {
        resetForm();
        switchTab('create');
    });

    $('#btnCancelForm').addEventListener('click', () => {
        switchTab('schedules');
    });

    // Add Lecturer to list in form
    $('#btnAddGv').addEventListener('click', () => {
        const name = $('#gvName').value.trim();
        const lesson = $('#gvLesson').value.trim();
        if (!name) return showToast('Vui lòng nhập tên giảng viên', true);
        if (!lesson) return showToast('Vui lòng nhập tên bài giảng', true);

        currentGvList.push({ name, lesson });
        $('#gvName').value = '';
        $('#gvLesson').value = '';
        $('#gvName').focus();
        renderGvList();
    });

    // Add Committee member
    $('#btnAddCommittee').addEventListener('click', () => {
        const name = $('#committeeName').value.trim();
        const email = $('#committeeEmail').value.trim();

        if (!name) return showToast('Vui lòng nhập tên thành viên Hội đồng', true);
        if (!email) return showToast('Vui lòng nhập email', true);

        currentCommitteeList.push({ name, email });
        $('#committeeName').value = '';
        $('#committeeEmail').value = '';
        $('#committeeName').focus();
        renderCommitteeList();
    });

    // Save Schedule
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('#scheduleName').value.trim();
        const date = $('#scheduleDate').value;
        const location = $('#scheduleLocation').value.trim();
        const startTime = $('#scheduleStartTime').value;
        const endTime = $('#scheduleEndTime').value;

        if (currentGvList.length === 0) {
            return showToast('Vui lòng thêm ít nhất 1 giảng viên', true);
        }
        if (currentCommitteeList.length === 0) {
            return showToast('Vui lòng thêm ít nhất 1 thành viên Hội đồng', true);
        }

        const schedule = {
            id: currentScheduleId || Date.now().toString(),
            name,
            date,
            location,
            startTime,
            endTime,
            lecturers: [...currentGvList],
            committee: [...currentCommitteeList]
        };

        if (currentScheduleId) {
            const idx = schedules.findIndex(s => String(s.id) === String(currentScheduleId));
            if (idx !== -1) schedules[idx] = schedule;
        } else {
            schedules.push(schedule);
        }

        renderSchedules();
        switchTab('schedules');
        showToast('Đã lưu! Đang đồng bộ lên Google Sheet...', false);

        // Sync to Google Sheet
        await syncScheduleToSheet(schedule, currentScheduleId ? 'update' : 'insert');
    });
}

async function syncScheduleToSheet(schedule, action) {
    if (!GOOGLE_SHEET_URL) return;

    const payload = {
        type: 'schedule',
        action: action,
        data: schedule
    };

    try {
        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow'
        });

        const result = await response.json();
        if (result.status === 'success') {
            showToast('✅ Đã đồng bộ lịch lên Sheet thành công!');
        } else {
            console.error('Sheet Error:', result);
            showToast('⚠️ Lỗi đồng bộ Sheet, vui lòng kiểm tra lại.', true);
        }
    } catch (err) {
        console.error('Fetch Error:', err);
        showToast('⚠️ Lỗi kết nối Google Sheet.', true);
    }
}

function switchTab(tabId) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    tabContents.forEach(c => {
        if (c.id === `tab${capitalize(tabId)}`) {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
}

function renderSchedules() {
    schedulesGrid.innerHTML = '';
    const container = $('#schedulesContainer');

    if (schedules.length === 0) {
        if (container) container.style.display = 'none';
        schedulesGrid.style.display = 'none';
        emptySchedules.style.display = 'block';
        return;
    }

    if (container) container.style.display = 'block';
    schedulesGrid.style.display = ''; // Reset display
    emptySchedules.style.display = 'none';

    schedules.forEach(schedule => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="td-gv-name">${escapeHtml(schedule.name)}</td>
            <td class="td-lesson">${formatDate(schedule.date)}</td>
            <td class="td-lesson">${schedule.startTime && schedule.endTime
                ? `<span class="time-slot-badge">🕐 ${formatTime(schedule.startTime)} - ${formatTime(schedule.endTime)}</span>`
                : '<span style="color:#94a3b8">—</span>'
            }</td>
            <td class="td-lesson">${schedule.location ? escapeHtml(schedule.location) : '-'}</td>
            <td><span class="stat-badge">${schedule.lecturers ? schedule.lecturers.length : 0} GV</span></td>
            <td><span class="stat-badge">${schedule.committee ? schedule.committee.length : 0} Hội đồng</span></td>
            <td class="td-action" style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn-primary btn-compact btn-generate" data-id="${schedule.id}" style="font-size: 0.8rem; padding: 4px 8px;">Cấp mã & Gửi Mail</button>
                <button class="btn-outline btn-edit" data-id="${schedule.id}">Sửa</button>
                <button class="btn-outline danger btn-delete" data-id="${schedule.id}">Xóa</button>
            </td>
        `;
        schedulesGrid.appendChild(tr);
    });

    // Action events
    $$('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            editSchedule(id);
        });
    });

    $$('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm('Bạn có chắc muốn xóa lịch này không?')) {
                schedules = schedules.filter(s => String(s.id) !== String(id));
                renderSchedules();
                showToast('Đang xóa trên Google Sheet...', false);
                await syncScheduleToSheet({ id }, 'delete');
            }
        });
    });

    $$('.btn-generate').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await generateAndSendCodes(id);
        });
    });
}

async function generateAndSendCodes(id) {
    const schedule = schedules.find(s => String(s.id) === String(id));
    if (!schedule) return;
    if (!schedule.committee || schedule.committee.length === 0) {
        return showToast('Không có thành viên Hội đồng nào để cấp mã!', true);
    }

    // Generate 8-digit codes for each
    schedule.committee.forEach(c => {
        c.accessCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    });

    showToast('Đang tạo mã và gửi email...', false);

    const payload = {
        type: 'generate_code',
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        committee: schedule.committee,
        lecturers: schedule.lecturers,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        date: formatDate(schedule.date),
        appUrl: 'https://hunghx.github.io/exam-teacher/'
    };

    try {
        const response = await fetch(GOOGLE_SHEET_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain' },
            redirect: 'follow'
        });
        const result = await response.json();
        if (result.status === 'success') {
            showToast('✅ Đã cấp mã và gửi email thành công!');
        } else {
            console.error(result);
            showToast('⚠️ Có lỗi xảy ra: ' + (result.message || ''), true);
        }
    } catch (err) {
        console.error(err);
        showToast('⚠️ Lỗi kết nối server', true);
    }
}

function renderGvList() {
    const list = $('#gvList');
    list.innerHTML = '';

    if (currentGvList.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.9rem;">Chưa có giảng viên nào</div>';
    } else {
        currentGvList.forEach((gv, idx) => {
            const item = document.createElement('div');
            item.className = 'gv-item';
            item.innerHTML = `
                <div class="gv-item-info">
                    <div class="gv-item-name">${escapeHtml(gv.name)}</div>
                    <div class="gv-item-lesson">Bài: ${escapeHtml(gv.lesson)}</div>
                </div>
                <button type="button" class="btn-remove-gv" data-index="${idx}" title="Xóa">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            list.appendChild(item);
        });

        $$('.btn-remove-gv').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                currentGvList.splice(idx, 1);
                renderGvList();
            });
        });
    }

    $('#gvCount').textContent = `${currentGvList.length} giảng viên`;
}

function renderCommitteeList() {
    const list = $('#committeeList');
    list.innerHTML = '';

    if (currentCommitteeList.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.9rem;">Chưa có thành viên nào</div>';
    } else {
        currentCommitteeList.forEach((member, idx) => {
            const item = document.createElement('div');
            item.className = 'gv-item';
            item.innerHTML = `
                <div class="gv-item-info">
                    <div class="gv-item-name">${escapeHtml(member.name)}</div>
                    <div class="gv-item-lesson">${escapeHtml(member.email)}</div>
                </div>
                <button type="button" class="btn-remove-committee" data-index="${idx}" title="Xóa">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            `;
            list.appendChild(item);
        });

        $$('.btn-remove-committee').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index);
                currentCommitteeList.splice(idx, 1);
                renderCommitteeList();
            });
        });
    }

    $('#committeeCount').textContent = `${currentCommitteeList.length} thành viên`;
}

function editSchedule(id) {
    const schedule = schedules.find(s => String(s.id) === String(id));
    if (!schedule) return;

    currentScheduleId = id;
    $('#scheduleName').value = schedule.name;
    $('#scheduleDate').value = schedule.date;
    $('#scheduleLocation').value = schedule.location || '';
    $('#scheduleStartTime').value = schedule.startTime || '';
    $('#scheduleEndTime').value = schedule.endTime || '';

    currentGvList = [...schedule.lecturers];
    renderGvList();
    currentCommitteeList = schedule.committee ? [...schedule.committee] : [];
    renderCommitteeList();

    $('#formTitle').textContent = 'Chỉnh Sửa Lịch Đánh Giá';
    $('#btnSaveText').textContent = 'Cập nhật';
    switchTab('create');
}

function resetForm() {
    currentScheduleId = null;
    scheduleForm.reset();
    currentGvList = [];
    currentCommitteeList = [];
    renderGvList();
    renderCommitteeList();
    $('#formTitle').textContent = 'Tạo Lịch Đánh Giá Mới';
    $('#btnSaveText').textContent = 'Lưu lịch đánh giá';
}

// =============================================
// RESULTS LOGIC
// =============================================
async function loadResults() {
    if (!GOOGLE_SHEET_URL) return;

    const select = $('#resultScheduleSelect');
    select.innerHTML = '<option value="" disabled selected>Đang tải dữ liệu...</option>';
    $('#resultsGrid').innerHTML = '';
    $('#emptyResults').style.display = 'none';
    const container = $('#resultsContainer');
    if (container) container.style.display = 'none';

    try {
        const res = await fetch(`${GOOGLE_SHEET_URL}?action=get_results`, { redirect: 'follow' });
        const data = await res.json();

        if (data.status === 'success') {
            allResults = data.data || [];
            processResults();
        } else {
            showToast('Lỗi tải kết quả', true);
            select.innerHTML = '<option value="" disabled selected>Lỗi tải dữ liệu</option>';
        }
    } catch (e) {
        console.error(e);
        showToast('Lỗi kết nối khi tải kết quả', true);
        select.innerHTML = '<option value="" disabled selected>Lỗi kết nối</option>';
    }
}

function processResults() {
    groupedResults = {};
    const select = $('#resultScheduleSelect');
    select.innerHTML = '';

    if (allResults.length === 0) {
        select.innerHTML = '<option value="" disabled selected>Chưa có dữ liệu</option>';
        $('#emptyResults').style.display = 'block';
        return;
    }

    // Lấy danh sách các Đợt (scheduleName) và timestamp mới nhất của đợt đó để sắp xếp
    const scheduleTimestamps = {};

    allResults.forEach(r => {
        const sName = r.scheduleName;
        if (!sName) return;

        if (!groupedResults[sName]) {
            groupedResults[sName] = {};
        }

        const gvName = r.lecturerName;
        if (!groupedResults[sName][gvName]) {
            groupedResults[sName][gvName] = {
                name: gvName,
                lesson: r.lesson,
                reviews: [],
                sumTotal: 0,
                sumScores: new Array(20).fill(0)
            };
        }

        groupedResults[sName][gvName].reviews.push(r);
        groupedResults[sName][gvName].sumTotal += r.total;

        for (let i = 0; i < 20; i++) {
            groupedResults[sName][gvName].sumScores[i] += r.scores[i];
        }

        // Cập nhật timestamp mới nhất cho schedule
        const ts = new Date(r.timestamp).getTime();
        if (!scheduleTimestamps[sName] || ts > scheduleTimestamps[sName]) {
            scheduleTimestamps[sName] = ts;
        }
    });

    // Sắp xếp các đợt theo timestamp mới nhất -> cũ nhất
    const sortedSchedules = Object.keys(groupedResults).sort((a, b) => {
        return (scheduleTimestamps[b] || 0) - (scheduleTimestamps[a] || 0);
    });

    sortedSchedules.forEach(sName => {
        const opt = document.createElement('option');
        opt.value = sName;
        opt.textContent = sName;
        select.appendChild(opt);
    });

    // Mặc định chọn đợt mới nhất
    if (sortedSchedules.length > 0) {
        select.value = sortedSchedules[0];
        renderResultsForSchedule(sortedSchedules[0]);
    } else {
        $('#emptyResults').style.display = 'block';
    }
}

function renderResultsForSchedule(sName) {
    const grid = $('#resultsGrid');
    grid.innerHTML = '';
    $('#emptyResults').style.display = 'none';

    const container = $('#resultsContainer');
    if (container) container.style.display = 'block';

    const lecturers = groupedResults[sName];
    if (!lecturers) {
        if (container) container.style.display = 'none';
        return;
    }

    Object.values(lecturers).forEach(gv => {
        const count = gv.reviews.length;
        const avgTotal = (gv.sumTotal / count).toFixed(1);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="td-gv-name">${gv.name}</td>
            <td class="td-lesson">${gv.lesson}</td>
            <td>${count} lượt</td>
            <td class="td-score">${avgTotal}</td>
            <td class="td-action">
                <button type="button">Xem chi tiết</button>
            </td>
        `;

        tr.querySelector('button').addEventListener('click', () => openModal(gv));
        grid.appendChild(tr);
    });
}

function openModal(gv) {
    $('#modalGvName').textContent = gv.name;
    $('#modalLesson').textContent = gv.lesson;

    const count = gv.reviews.length;
    $('#modalReviewCount').textContent = count;

    const avgTotal = (gv.sumTotal / count).toFixed(1);
    $('#modalTotalScore').textContent = avgTotal;

    const list = $('#modalCriteriaList');
    list.innerHTML = '';

    const labels = [
        "1. Xác định được vị trí, mục tiêu bài học",
        "2. Cấu trúc bài học hợp lý",
        "3. Trọng tâm bài giảng rõ ràng",
        "4. Nội dung bài giảng chính xác",
        "5. Liên hệ thực tế tốt",
        "6. Sử dụng câu hỏi gợi mở, tương tác",
        "7. Phương pháp giảng dạy phù hợp",
        "8. Phân bổ thời gian hợp lý",
        "9. Tác phong sư phạm chuẩn mực",
        "10. Ngôn ngữ trình bày rõ ràng",
        "11. Trình bày bảng/slide khoa học",
        "12. Sử dụng công cụ hỗ trợ hiệu quả",
        "13. Khả năng bao quát lớp học",
        "14. Khả năng xử lý tình huống sư phạm",
        "15. Giải đáp thắc mắc thỏa đáng",
        "16. Nhấn mạnh được kiến thức cốt lõi",
        "17. Củng cố bài học hiệu quả",
        "18. Đánh giá kết quả học tập của HV",
        "19. Giao bài tập về nhà hợp lý",
        "20. Truyền cảm hứng, tạo động lực"
    ];

    for (let i = 0; i < 20; i++) {
        const avgScore = (gv.sumScores[i] / count).toFixed(1);
        const item = document.createElement('div');
        item.className = 'criteria-item';
        item.innerHTML = `
            <div class="criteria-name">${labels[i]}</div>
            <div class="criteria-score">${avgScore}</div>
        `;
        list.appendChild(item);
    }

    $('#resultModal').classList.add('show');
}

function closeModal() {
    $('#resultModal').classList.remove('show');
}

// Helpers
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
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

/**
 * Format a time value from Google Sheets.
 * Accepts: "HH:MM", "HH:MM:SS", or ISO datetime string like "1899-12-30T02:53:30.000Z"
 * Returns: "HH:MM"
 */
function formatTime(timeVal) {
    if (!timeVal) return '';
    const s = String(timeVal);
    // Already HH:MM or HH:MM:SS
    if (/^\d{1,2}:\d{2}/.test(s)) {
        return s.substring(0, 5);
    }
    // ISO string from Google Sheets
    if (s.includes('T')) {
        // Try to parse the time components from ISO string and offset it back from UTC to GMT+7 (in 1899, Saigon offset is +07:06:30)
        // This is timezone-independent and prevents issues where client browser timezone is not Saigon
        const match = s.match(/T(\d{2}):(\d{2}):(\d{2})/);
        if (match) {
            let h = parseInt(match[1], 10);
            let m = parseInt(match[2], 10);
            let sec = parseInt(match[3], 10);

            // Add 7 hours, 6 minutes, 30 seconds (Saigon historical offset in 1899)
            m += 6;
            sec += 30;
            if (sec >= 60) {
                m += Math.floor(sec / 60);
                sec = sec % 60;
            }
            h += 7;
            if (m >= 60) {
                h += Math.floor(m / 60);
                m = m % 60;
            }
            h = h % 24;

            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        try {
            const d = new Date(s);
            const h = String(d.getUTCHours()).padStart(2, '0');
            const m = String(d.getUTCMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        } catch (e) { }
    }
    return s;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, isError = false) {
    const toast = $('#toast');
    const toastMsg = $('#toastMsg');

    toastMsg.textContent = message;
    toast.style.background = isError ? '#fef2f2' : 'var(--green-soft)';
    toast.style.color = isError ? 'var(--red)' : '#059669';
    toast.style.borderColor = isError ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)';
    toast.querySelector('.toast-icon').textContent = isError ? '✕' : '✓';

    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
