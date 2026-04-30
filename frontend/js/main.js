const LOCAL_STORAGE_KEYS = [
    "sgu-grade-predictor:dashboard",
    "sgu-grade-predictor:dashboard:v3",
    "sgu-grade-predictor:dashboard:v2",
];

const DEFAULT_GRADE_TYPE = "type1";

const pdfInput = document.getElementById("pdfInput");
const jsonInput = document.getElementById("jsonInput");
const uploadLabel = document.getElementById("uploadLabel");
const overviewPanel = document.getElementById("overview-panel");
const graduationPlannerPanel = document.getElementById("graduationPlannerPanel");
const globalGradeSwitch = document.getElementById("globalGradeSwitch");
const semesterContainer = document.getElementById("semester-container");
const jsonMenu = document.getElementById("jsonMenu");
const featureTabs = Array.from(document.querySelectorAll('[data-action="switch-feature"]'));
const featurePanels = Array.from(document.querySelectorAll("[data-feature-panel]"));
const toastEl = document.getElementById("toast");
const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");
const guideModal = document.getElementById("guideModal");
const topToggleButton = document.getElementById("topToggleButton");
const mobileEditorSheet = document.getElementById("mobileEditorSheet");
const gradeStorage = window.gradeStorage;
const gradePdfParser = window.gradePdfParser;
let toastTimer = null;
const TOP_COLLAPSE_KEY = "sgu-grade-predictor:top-collapsed";
const PROGRAM_CREDITS_KEY = "sgu-grade-predictor:program-credits";

const appState = {
    sourceSubjects: [],
    viewSubjects: [],
    summarySubjects: [],
    semesterStates: {},
    currentFileName: "",
    hasUnsavedChanges: false,
    openEditorSubjectId: null,
    dataOrigin: "empty",
    gradeType: DEFAULT_GRADE_TYPE,
    subjectSeed: 0,
    pendingDeleteSemesterKey: null,
    currentFeature: "bang-diem",
    totalProgramCredits: Number(localStorage.getItem(PROGRAM_CREDITS_KEY) || 0) || 0,
    mobileEditorSubjectId: null,
};

document.addEventListener("click", handleDocumentClick);
document.addEventListener("input", handleDocumentInput);
document.addEventListener("change", handleDocumentChange);
document.addEventListener("keydown", handleKeydown);
pdfInput.addEventListener("change", handleUploadPdf);
jsonInput.addEventListener("change", handleImportJsonFile);
if (uploadLabel && pdfInput) {
    uploadLabel.addEventListener("click", () => {
        pdfInput.click();
    });
    uploadLabel.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pdfInput.click();
        }
    });
}

function applyTopCollapsedState(collapsed) {
    document.body.classList.toggle("top-collapsed", collapsed);
    if (!topToggleButton) return;
    topToggleButton.textContent = collapsed ? "Mở rộng" : "Thu gọn";
    topToggleButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
}

function initializeTopAreaToggle() {
    const stored = localStorage.getItem(TOP_COLLAPSE_KEY) === "1";
    applyTopCollapsedState(stored);

    if (!topToggleButton) return;
    topToggleButton.addEventListener("click", () => {
        const nextCollapsed = !document.body.classList.contains("top-collapsed");
        applyTopCollapsedState(nextCollapsed);
        localStorage.setItem(TOP_COLLAPSE_KEY, nextCollapsed ? "1" : "0");
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatNumber(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return Number(value).toFixed(digits);
}

function formatInteger(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return Number(value);
}

function formatEditableValue(field, value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "";
    }

    if (field === "diem_kiem_tra" || field === "diem_thi") {
        return Number(value).toFixed(1);
    }

    return String(Math.round(Number(value)));
}

function parseCreditInput(rawValue) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
        return 0;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(30, Math.round(parsed)));
}

function parseProgramCreditInput(rawValue) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
        return 0;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(300, Math.round(parsed)));
}

function roundToStep(value, step) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    const precision = step >= 1 ? 0 : String(step).split(".")[1]?.length || 0;
    const factor = 10 ** precision;
    return Math.round((numericValue + Number.EPSILON) * factor) / factor;
}

function normalizeInputValue(field, rawValue) {
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
        return null;
    }

    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
        return null;
    }

    if (field === "diem_kiem_tra" || field === "diem_thi") {
        return Math.min(10, Math.max(0, roundToStep(numericValue, 0.1)));
    }

    return Math.min(100, Math.max(0, Math.round(numericValue)));
}

function updateUploadLabel() {
    if (!uploadLabel) {
        return;
    }

    if (appState.currentFileName && (appState.dataOrigin === "pdf" || appState.dataOrigin === "local")) {
        uploadLabel.textContent = appState.currentFileName;
        uploadLabel.title = appState.currentFileName;
        return;
    }

    uploadLabel.textContent = "+";
    uploadLabel.title = "Chọn file PDF";
}

function toSemesterKey(subject) {
    return subject?.hoc_ky || "Học kỳ chưa xác định";
}

function showToast(message, type = "info") {
    if (!toastEl) return;
    if (toastTimer) {
        clearTimeout(toastTimer);
    }

    toastEl.textContent = message;
    toastEl.classList.remove("is-success", "is-error", "is-info", "is-show");
    toastEl.classList.add(`is-${type}`);

    // Trigger reflow for restart animation.
    void toastEl.offsetWidth;
    toastEl.classList.add("is-show");

    toastTimer = setTimeout(() => {
        toastEl.classList.remove("is-show");
    }, 5000);
}

function renderFeatureTabs() {
    featureTabs.forEach((tab) => {
        const isActive = tab.dataset.feature === appState.currentFeature;
        tab.classList.toggle("is-active", isActive);
    });

    featurePanels.forEach((panel) => {
        const isActive = panel.dataset.featurePanel === appState.currentFeature;
        panel.classList.toggle("is-active", isActive);
        panel.hidden = !isActive;
    });

}

function switchFeature(featureName) {
    if (!featureName) return;
    appState.currentFeature = featureName;
    renderFeatureTabs();

    if (featureName === "bang-diem") {
        renderDashboard();
        return;
    }

    if (featureName === "gpa-tot-nghiep") {
        renderGraduationPlanner();
    }
}

function closeJsonMenu() {
    if (jsonMenu) {
        jsonMenu.classList.remove("is-open");
    }
}

function toggleJsonMenu() {
    if (!jsonMenu) return;
    jsonMenu.classList.toggle("is-open");
}

function isMobileViewport() {
    return window.matchMedia("(max-width: 767.98px)").matches;
}

// Chuẩn hóa object trạng thái học kỳ chỉ với 2 cờ chính: fixed và userCreated.
function normalizeSemesterState(state = {}) {
    return {
        confirmed: state.confirmed === true,
        fixed: state.fixed === true,
        userCreated: state.userCreated === true,
    };
}

function buildSemesterStates(subjects, previousStates = {}) {
    const nextStates = {};
    const semesterKeys = Array.from(new Set((subjects || []).map(toSemesterKey)));

    semesterKeys.forEach((semesterKey) => {
        nextStates[semesterKey] = normalizeSemesterState(previousStates?.[semesterKey] || {});
    });

    Object.keys(previousStates || {}).forEach((semesterKey) => {
        if (!nextStates[semesterKey]) {
            nextStates[semesterKey] = normalizeSemesterState(previousStates[semesterKey] || {});
        }
    });

    return nextStates;
}

function createSubjectId() {
    appState.subjectSeed += 1;
    return `subject-${Date.now()}-${appState.subjectSeed}`;
}

async function getStoredPayload() {
    if (!gradeStorage?.loadDashboardState) {
        return null;
    }

    try {
        const payload = await gradeStorage.loadDashboardState({ legacyKeys: LOCAL_STORAGE_KEYS });
        const subjects = Array.isArray(payload?.sourceSubjects)
            ? payload.sourceSubjects
            : Array.isArray(payload?.subjects)
                ? payload.subjects
                : Array.isArray(payload?.viewSubjects)
                    ? payload.viewSubjects
                    : null;

        if (!subjects) {
            return null;
        }

        return {
            payload,
            subjects,
        };
    } catch (error) {
        console.warn("Không thể đọc IndexedDB", error);
        return null;
    }
}

function persistLocalState() {
    if (!gradeStorage?.saveDashboardState) {
        return;
    }

    const payload = {
        version: 2,
        currentFileName: appState.currentFileName,
        semesterStates: appState.semesterStates,
        sourceSubjects: appState.sourceSubjects,
        gradeType: appState.gradeType,
        dataOrigin: appState.dataOrigin,
    };

    gradeStorage.saveDashboardState(payload, { legacyKeys: LOCAL_STORAGE_KEYS })
        .catch((error) => {
            console.warn("Không thể lưu IndexedDB", error);
        });
}

async function hydrateFromLocalState() {
    const stored = await getStoredPayload();
    if (!stored) {
        return false;
    }

    const { payload, subjects } = stored;
    appState.currentFileName = payload?.currentFileName || "";
    appState.gradeType = payload?.gradeType === "type2" ? "type2" : "type1";
    appState.dataOrigin = payload?.dataOrigin || "local";
    appState.sourceSubjects = subjects.map((subject, index) => normalizeIncomingSubject(subject, index));
    appState.semesterStates = buildSemesterStates(appState.sourceSubjects, payload?.semesterStates || {});
    appState.hasUnsavedChanges = false;
    appState.openEditorSubjectId = null;
    rebuildDerivedSubjects();
    updateUploadLabel();
    persistLocalState();
    return true;
}

function normalizeIncomingSubject(subject, index) {
    const isOfficial = subject?.da_co_diem === true;
    const rawDiemKiemTra = parseNumericValue(subject?.diem_kiem_tra);
    const rawDiemThi = parseNumericValue(subject?.diem_thi);
    const normalizedTrongSo1 = normalizeWeightPercent(subject?.trong_so_1, 40);
    const normalizedTrongSo2 = normalizeWeightPercent(subject?.trong_so_2, 60);
    const normalizedScore10 = isOfficial ? parseNumericValue(subject?.diem_he_10) : null;
    const hasValidStoredPrediction = !isOfficial
        && rawDiemKiemTra !== null
        && rawDiemThi !== null
        && normalizedTrongSo1 !== null
        && normalizedTrongSo2 !== null
        && Math.abs((normalizedTrongSo1 + normalizedTrongSo2) - 100) < 1e-6;

    return {
        ...subject,
        __id: subject?.__id || `subject-${index}`,
        ma_mon: String(subject?.ma_mon || "").trim(),
        ten_mon: String(subject?.ten_mon || "").trim(),
        nhom: subject?.nhom || "01",
        so_tin_chi: parseNumericValue(subject?.so_tin_chi) ?? 0,
        hoc_ky: toSemesterKey(subject),
        da_co_diem: isOfficial,
        prediction_saved: subject?.prediction_saved === true || hasValidStoredPrediction,
        la_du_doan: false,
        diem_he_10: isOfficial ? normalizedScore10 : null,
        diem_he_4: isOfficial ? convert10to4(normalizedScore10, appState.gradeType) : null,
        diem_chu: isOfficial ? convert10toLetter(normalizedScore10, appState.gradeType) : "--",
        diem_kiem_tra: isOfficial ? parseNumericValue(subject?.diem_kiem_tra) : rawDiemKiemTra,
        diem_thi: isOfficial ? parseNumericValue(subject?.diem_thi) : rawDiemThi,
        trong_so_1: normalizedTrongSo1,
        trong_so_2: normalizedTrongSo2,
        passed: isOfficial
            ? (subject?.passed ?? (normalizedScore10 !== null && normalizedScore10 >= (isExcludedSubject(subject) ? 5.0 : 4.0)))
            : null,
    };
}

function rebuildDerivedSubjects() {
    appState.semesterStates = buildSemesterStates(appState.sourceSubjects, appState.semesterStates);
    // Always preview predicted score so every change can be recalculated immediately.
    appState.viewSubjects = appState.sourceSubjects.map((subject) => buildPredictedSubject(subject, {
        preview: true,
        gradeType: appState.gradeType,
    }));
    appState.summarySubjects = appState.sourceSubjects.map((subject) => buildPredictedSubject(subject, { preview: true, gradeType: appState.gradeType }));
}

function getSubjectById(subjectId) {
    return appState.sourceSubjects.find((subject) => subject.__id === subjectId) || null;
}

function getSemesterState(semesterKey) {
    return normalizeSemesterState(appState.semesterStates?.[semesterKey] || {});
}

function isSemesterConfirmed(semesterKey) {
    return getSemesterState(semesterKey).confirmed === true;
}

// Suy quyền thao tác từ 2 thuộc tính fixed và userCreated.
function getSemesterPermissions(semesterKey) {
    const state = getSemesterState(semesterKey);

    if (state.userCreated === true && state.fixed === false) {
        return {
            canToggleLock: true,
            canDeleteSemester: true,
            canAddSubject: true,
            canEditSubject: true,
            canDeleteSubject: true,
            dimDeleteButton: false,
        };
    }

    if (state.fixed === true) {
        return {
            canToggleLock: false,
            canDeleteSemester: false,
            canAddSubject: false,
            canEditSubject: false,
            canDeleteSubject: false,
            dimDeleteButton: true,
        };
    }

    return {
        canToggleLock: true,
        canDeleteSemester: false,
        canAddSubject: false,
        canEditSubject: true,
        canDeleteSubject: false,
        dimDeleteButton: true,
    };
}

function semesterHasEditableSubjects(subjects) {
    return (subjects || []).some(isPredictableSubject);
}

function setMirroredWeight(subjectId, field, value) {
    const partnerField = field === "trong_so_1" ? "trong_so_2" : "trong_so_1";
    const mirroredValue = value === null ? null : Math.max(0, Math.min(100, 100 - value));
    const subject = getSubjectById(subjectId);

    if (!subject) return;
    subject[partnerField] = mirroredValue;

    const partnerInput = document.querySelector(
        `[data-subject-id="${subjectId}"][data-predict-field="${partnerField}"]`
    );

    if (partnerInput) {
        partnerInput.value = formatEditableValue(partnerField, mirroredValue);
    }
}

function updatePredictionField(subjectId, field, rawValue, options = {}) {
    const subject = getSubjectById(subjectId);
    if (!subject) return;

    const permissions = getSemesterPermissions(subject.hoc_ky);
    if (isSemesterConfirmed(subject.hoc_ky) || permissions.canEditSubject !== true) {
        return;
    }

    subject[field] = normalizeInputValue(field, rawValue);
    if (isPredictableSubject(subject)) {
        subject.prediction_saved = canApplyPrediction(subject);
    }

    if ((field === "trong_so_1" || field === "trong_so_2") && !options.skipMirror && subject[field] !== null) {
        setMirroredWeight(subjectId, field, subject[field]);
    }

    if (!options.silent) {
        appState.hasUnsavedChanges = true;
        persistLocalState();
    }
}

function isDuplicateCodeInSemester(subject, nextCode) {
    if (!subject || !nextCode) return false;
    const normalizedCode = nextCode.trim().toUpperCase();
    if (!normalizedCode) return false;

    return appState.sourceSubjects.some((item) => {
        if (item.__id === subject.__id) return false;
        if (item.hoc_ky !== subject.hoc_ky) return false;
        return String(item.ma_mon || "").trim().toUpperCase() === normalizedCode;
    });
}

function updateBasicField(subjectId, field, rawValue) {
    const subject = getSubjectById(subjectId);
    if (!subject) return;
    const permissions = getSemesterPermissions(subject.hoc_ky);
    if (isSemesterConfirmed(subject.hoc_ky) || permissions.canEditSubject !== true) return;

    if (field === "ma_mon") {
        const nextCode = String(rawValue || "").trim();
        if (isDuplicateCodeInSemester(subject, nextCode)) {
            showToast("Mã môn đã tồn tại trong học kỳ này.", "error");
            return;
        }
        subject.ma_mon = nextCode;
    } else if (field === "ten_mon") {
        subject.ten_mon = String(rawValue || "").trim();
    } else if (field === "so_tin_chi") {
        subject.so_tin_chi = parseCreditInput(rawValue);
    }

    appState.hasUnsavedChanges = true;
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
}

function syncGlobalGradeSwitch() {
    if (!globalGradeSwitch) return;
    globalGradeSwitch.checked = appState.gradeType === "type2";
}

function getLatestParsedSemester() {
    const parsed = Object.keys(appState.semesterStates)
        .map((key) => ({ key, parsed: parseSemesterKey(key) }))
        .filter((item) => item.parsed);

    if (!parsed.length) return null;
    parsed.sort((a, b) => compareSemesterKeys(a.key, b.key));
    return parsed[parsed.length - 1].parsed;
}

function getDefaultAcademicYear() {
    const now = new Date();
    const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return { startYear: year, endYear: year + 1 };
}

function buildSemesterName(semesterNumber, startYear, endYear) {
    return `Học kỳ ${semesterNumber} - Năm học ${startYear}-${endYear}`;
}

function getNextSemesterName() {
    const latest = getLatestParsedSemester();
    if (latest) {
        if (latest.semesterNumber < 3) {
            return buildSemesterName(latest.semesterNumber + 1, latest.startYear, latest.endYear);
        }

        return buildSemesterName(1, latest.startYear + 1, latest.endYear + 1);
    }

    const fallback = getDefaultAcademicYear();
    return buildSemesterName(1, fallback.startYear, fallback.endYear);
}

function addSemester() {
    const semesterName = getNextSemesterName();
    if (!appState.semesterStates[semesterName]) {
        appState.semesterStates[semesterName] = {
            confirmed: false,
            fixed: false,
            userCreated: true,
        };
    }

    appState.hasUnsavedChanges = true;
    persistLocalState();
    renderDashboard();
    showToast("Đã thêm học kỳ mới.", "success");
}

function addSubjectToSemester(semesterKey) {
    const permissions = getSemesterPermissions(semesterKey);
    if (!semesterKey || isSemesterConfirmed(semesterKey) || permissions.canAddSubject !== true) {
        showToast("Học kỳ này không cho phép thêm môn.", "error");
        return;
    }

    const newSubject = normalizeIncomingSubject({
        __id: createSubjectId(),
        ma_mon: "",
        ten_mon: "Môn học mới",
        nhom: "01",
        so_tin_chi: 3,
        hoc_ky: semesterKey,
        da_co_diem: false,
        prediction_saved: false,
        diem_he_10: null,
        diem_he_4: null,
        diem_chu: "--",
        diem_kiem_tra: null,
        diem_thi: null,
        trong_so_1: 40,
        trong_so_2: 60,
    }, appState.sourceSubjects.length + 1);

    appState.sourceSubjects.push(newSubject);
    appState.openEditorSubjectId = newSubject.__id;
    if (isMobileViewport()) {
        appState.mobileEditorSubjectId = newSubject.__id;
    }
    appState.hasUnsavedChanges = true;
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
    showToast("Đã thêm môn mới.", "success");
}

function deleteSubject(subjectId) {
    const subject = getSubjectById(subjectId);
    if (!subject) return;
    const permissions = getSemesterPermissions(subject.hoc_ky);
    if (isSemesterConfirmed(subject.hoc_ky) || permissions.canDeleteSubject !== true) {
        showToast("Học kỳ đã khóa, không thể xóa môn.", "error");
        return;
    }

    appState.sourceSubjects = appState.sourceSubjects.filter((item) => item.__id !== subjectId);
    appState.openEditorSubjectId = null;
    if (appState.mobileEditorSubjectId === subjectId) {
        appState.mobileEditorSubjectId = null;
    }
    appState.hasUnsavedChanges = true;
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
    showToast("Đã xóa môn học.", "success");
}

function hasFinalTotalScore(subject) {
    const numeric10 = parseNumericValue(subject?.diem_he_10);
    const numeric4 = parseNumericValue(subject?.diem_he_4);
    const letter = String(subject?.diem_chu || "").trim().toUpperCase();
    return numeric10 !== null || numeric4 !== null || (letter !== "" && letter !== "--");
}

function buildSemesterStatesFromPdf(subjects) {
    // Rule PDF: tất cả môn có điểm tổng => fixed; tất cả môn chưa có điểm tổng => không fixed.
    // Trường hợp lẫn điểm và chưa điểm sẽ coi là fixed để tránh chỉnh sửa sai dữ liệu PDF.
    const bySemester = {};
    (subjects || []).forEach((subject) => {
        const semesterKey = toSemesterKey(subject);
        if (!bySemester[semesterKey]) {
            bySemester[semesterKey] = [];
        }
        bySemester[semesterKey].push(subject);
    });

    const states = {};
    Object.entries(bySemester).forEach(([semesterKey, list]) => {
        const allHaveTotal = list.every(hasFinalTotalScore);
        const allNoTotal = list.every((subject) => !hasFinalTotalScore(subject));
        const isFixed = allHaveTotal || !allNoTotal;

        states[semesterKey] = {
            confirmed: isFixed,
            fixed: isFixed,
            userCreated: false,
        };
    });

    return states;
}

function askDeleteSemester(semesterKey) {
    // Mở modal xác nhận trước khi xóa kỳ.
    if (!canDeleteSemester(semesterKey)) {
        showToast("Học kỳ này không thể xóa.", "error");
        return;
    }

    const subjectCount = appState.sourceSubjects.filter((subject) => subject.hoc_ky === semesterKey).length;
    appState.pendingDeleteSemesterKey = semesterKey;
    if (!confirmModal || !confirmModalTitle || !confirmModalMessage) return;

    confirmModalTitle.textContent = "Xác nhận xóa học kỳ";
    confirmModalMessage.textContent = subjectCount > 0
        ? `Học kỳ này có ${subjectCount} môn. Bạn có chắc chắn muốn xóa toàn bộ học kỳ này không?`
        : "Bạn có chắc chắn muốn xóa học kỳ này không?";
    confirmModal.classList.add("is-open");
    confirmModal.setAttribute("aria-hidden", "false");
}

function closeDeleteSemesterModal() {
    appState.pendingDeleteSemesterKey = null;
    if (confirmModal) {
        confirmModal.classList.remove("is-open");
        confirmModal.setAttribute("aria-hidden", "true");
    }
}

function openGuideModal() {
    if (!guideModal) return;
    guideModal.classList.add("is-open");
    guideModal.setAttribute("aria-hidden", "false");
}

function closeGuideModal() {
    if (!guideModal) return;
    guideModal.classList.remove("is-open");
    guideModal.setAttribute("aria-hidden", "true");
}

function closeMobileEditorSheet() {
    appState.mobileEditorSubjectId = null;
    document.body.classList.remove("mobile-editor-open");
    if (!mobileEditorSheet) return;
    mobileEditorSheet.classList.remove("is-open");
    mobileEditorSheet.setAttribute("aria-hidden", "true");
}

function confirmDeleteSemester() {
    // Xóa cả kỳ và toàn bộ môn thuộc kỳ đó sau xác nhận.
    const semesterKey = appState.pendingDeleteSemesterKey;
    if (!semesterKey) return closeDeleteSemesterModal();
    if (!canDeleteSemester(semesterKey)) {
        closeDeleteSemesterModal();
        return;
    }

    appState.sourceSubjects = appState.sourceSubjects.filter((subject) => subject.hoc_ky !== semesterKey);
    delete appState.semesterStates[semesterKey];
    appState.openEditorSubjectId = null;
    appState.hasUnsavedChanges = true;
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
    closeDeleteSemesterModal();
    showToast("Đã xóa học kỳ.", "success");
}

function exportStateAsJson() {
    // Export full dashboard state so user can move data across devices without re-uploading PDF.
    if (!appState.sourceSubjects.length && !Object.keys(appState.semesterStates).length) {
        showToast("Chưa có dữ liệu để xuất JSON.", "error");
        return;
    }

    const payload = {
        version: 2,
        exportedAt: new Date().toISOString(),
        currentFileName: appState.currentFileName,
        gradeType: appState.gradeType,
        semesterStates: appState.semesterStates,
        sourceSubjects: appState.sourceSubjects,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    link.href = url;
    link.download = `sgu-grade-data_${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã xuất file JSON.", "success");
}

function normalizeCsvCell(value) {
    const normalized = String(value ?? "").replace(/"/g, "\"\"");
    return `"${normalized}"`;
}

function exportReportAsCsv() {
    if (!appState.summarySubjects.length) {
        showToast("Chưa có dữ liệu để xuất CSV.", "error");
        return;
    }

    const resolved = resolveRetakes(appState.summarySubjects);
    const semesterKeys = sortSemesterKeys(Object.keys(resolved.byHocKy), "asc");
    const lines = [[
        "Hoc ky", "Ma mon", "Ten mon", "Nhom", "Tin chi", "He 10", "He 4", "Diem chu", "Trang thai"
    ].join(",")];

    semesterKeys.forEach((semesterKey) => {
        (resolved.byHocKy[semesterKey] || []).forEach((subject) => {
            lines.push([
                normalizeCsvCell(subject.hoc_ky),
                normalizeCsvCell(subject.ma_mon),
                normalizeCsvCell(subject.ten_mon),
                normalizeCsvCell(subject.nhom || "01"),
                normalizeCsvCell(formatInteger(subject.so_tin_chi)),
                normalizeCsvCell(hasResolvedGrade(subject) ? formatNumber(subject.diem_he_10, 1) : "--"),
                normalizeCsvCell(hasResolvedGrade(subject) ? formatNumber(subject.diem_he_4, 1) : "--"),
                normalizeCsvCell(hasResolvedGrade(subject) ? (subject.diem_chu || "--") : "--"),
                normalizeCsvCell(hasResolvedGrade(subject) ? (subject.passed ? "Dat" : "Khong dat") : "Chua co diem"),
            ].join(","));
        });
    });

    const overall = calculateCumulativeGPAFull(appState.summarySubjects.filter((item) => isSemesterConfirmed(item.hoc_ky)));
    lines.push("");
    lines.push(["Tong ket", "", "", "", "", "", "", "", ""].join(","));
    lines.push([
        normalizeCsvCell("GPA tich luy he 4"),
        normalizeCsvCell(overall.co_du_lieu ? formatNumber(overall.gpa4, 2) : "--"),
        "", "", "", "", "", "", ""
    ].join(","));
    lines.push([
        normalizeCsvCell("GPA tich luy he 10"),
        normalizeCsvCell(overall.co_du_lieu ? formatNumber(overall.gpa10, 2) : "--"),
        "", "", "", "", "", "", ""
    ].join(","));
    lines.push([
        normalizeCsvCell("Tin chi tich luy"),
        normalizeCsvCell(overall.co_du_lieu ? formatInteger(overall.tong_tin) : "--"),
        "", "", "", "", "", "", ""
    ].join(","));

    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    link.href = url;
    link.download = `sgu-grade-report_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Đã xuất báo cáo CSV.", "success");
}

function exportReportAsPdf() {
    if (!appState.summarySubjects.length) {
        showToast("Chưa có dữ liệu để xuất PDF.", "error");
        return;
    }

    const confirmedSubjects = appState.summarySubjects.filter((item) => isSemesterConfirmed(item.hoc_ky));
    const cumulative = calculateCumulativeGPAFull(confirmedSubjects);
    const rows = appState.summarySubjects.map((subject, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(subject.hoc_ky || "--")}</td>
            <td>${escapeHtml(subject.ma_mon || "--")}</td>
            <td>${escapeHtml(subject.ten_mon || "--")}</td>
            <td>${escapeHtml(formatInteger(subject.so_tin_chi))}</td>
            <td>${escapeHtml(hasResolvedGrade(subject) ? formatNumber(subject.diem_he_10, 1) : "--")}</td>
            <td>${escapeHtml(hasResolvedGrade(subject) ? formatNumber(subject.diem_he_4, 1) : "--")}</td>
            <td>${escapeHtml(hasResolvedGrade(subject) ? (subject.diem_chu || "--") : "--")}</td>
        </tr>
    `).join("");

    const reportWindow = window.open("", "_blank", "width=1000,height=760");
    if (!reportWindow) {
        showToast("Trình duyệt đang chặn popup khi xuất PDF.", "error");
        return;
    }

    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="utf-8">
            <title>Báo cáo học tập SGU</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #1f2937; }
                h1 { margin: 0 0 6px; font-size: 22px; }
                p { margin: 0 0 4px; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
                th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
                th { background: #f3f4f6; }
            </style>
        </head>
        <body>
            <h1>Báo cáo học tập SGU</h1>
            <p>Thời gian xuất: ${escapeHtml(new Date().toLocaleString("vi-VN"))}</p>
            <p>GPA tích lũy hệ 4: <strong>${cumulative.co_du_lieu ? escapeHtml(formatNumber(cumulative.gpa4, 2)) : "--"}</strong></p>
            <p>GPA tích lũy hệ 10: <strong>${cumulative.co_du_lieu ? escapeHtml(formatNumber(cumulative.gpa10, 2)) : "--"}</strong></p>
            <p>Tín chỉ tích lũy: <strong>${cumulative.co_du_lieu ? escapeHtml(formatInteger(cumulative.tong_tin)) : "--"}</strong></p>
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Học kỳ</th>
                        <th>Mã môn</th>
                        <th>Tên môn</th>
                        <th>Tín chỉ</th>
                        <th>Hệ 10</th>
                        <th>Hệ 4</th>
                        <th>Chữ</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </body>
        </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
}

function importJsonPayload(payload, importedName = "") {
    // Import uses the same schema as export; app state is restored then saved back to IndexedDB.
    const subjects = Array.isArray(payload?.sourceSubjects)
        ? payload.sourceSubjects
        : Array.isArray(payload?.subjects)
            ? payload.subjects
            : null;

    if (!subjects) {
        throw new Error("File JSON không đúng định dạng.");
    }

    appState.currentFileName = importedName || payload?.currentFileName || "Dữ liệu JSON";
    appState.gradeType = payload?.gradeType === "type2" ? "type2" : "type1";
    appState.sourceSubjects = subjects.map((subject, index) => normalizeIncomingSubject(subject, index));
    appState.semesterStates = buildSemesterStates(appState.sourceSubjects, payload?.semesterStates || {});
    appState.hasUnsavedChanges = false;
    appState.openEditorSubjectId = null;
    appState.dataOrigin = "json";
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
    showToast("Đã nhập dữ liệu từ JSON.", "success");
}

async function handleImportJsonFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const content = await file.text();
        const payload = JSON.parse(content);
        importJsonPayload(payload, file.name);
    } catch (error) {
        showToast(error.message || "Không thể nhập file JSON.", "error");
    } finally {
        jsonInput.value = "";
    }
}

function toggleGradeType(checked) {
    appState.gradeType = resolveGradeTypeBySwitch(checked);
    appState.hasUnsavedChanges = true;
    rebuildDerivedSubjects();
    persistLocalState();
    renderDashboard();
}

function handleDocumentInput(event) {
    const input = event.target.closest("[data-predict-field]");
    if (input) {
        updatePredictionField(input.dataset.subjectId, input.dataset.predictField, input.value);
        return;
    }

    const programCreditsInput = event.target.closest('[data-action="update-program-credits"]');
    if (programCreditsInput) {
        // Không render lại khi đang gõ để tránh mất focus/chặn nhập nhiều chữ số.
        return;
    }

}

function handleKeydown(event) {
    if (event.key === "Escape" && confirmModal?.classList.contains("is-open")) {
        closeDeleteSemesterModal();
        return;
    }

    if (event.key === "Escape" && guideModal?.classList.contains("is-open")) {
        closeGuideModal();
    }
}

function handleDocumentChange(event) {
    const input = event.target.closest("[data-predict-field]");
    if (input) {
        const subject = getSubjectById(input.dataset.subjectId);
        if (!subject) return;
        input.value = formatEditableValue(input.dataset.predictField, subject[input.dataset.predictField]);
        rebuildDerivedSubjects();
        renderDashboard();
        return;
    }

    const basicInput = event.target.closest("[data-basic-field]");
    if (basicInput) {
        updateBasicField(basicInput.dataset.subjectId, basicInput.dataset.basicField, basicInput.value);
        return;
    }

    const switchInput = event.target.closest('[data-action="toggle-grade-type"]');
    if (switchInput) {
        toggleGradeType(switchInput.checked);
        return;
    }

    const programCreditsInput = event.target.closest('[data-action="update-program-credits"]');
    if (programCreditsInput) {
        appState.totalProgramCredits = parseProgramCreditInput(programCreditsInput.value);
        localStorage.setItem(PROGRAM_CREDITS_KEY, String(appState.totalProgramCredits));
        renderGraduationPlanner();
    }
}

function handleDocumentClick(event) {
    if (!event.target.closest("#jsonMenu")) {
        closeJsonMenu();
    }

    const featureButton = event.target.closest('[data-action="switch-feature"]');
    if (featureButton) {
        switchFeature(featureButton.dataset.feature);
        return;
    }

    const toggleJsonMenuButton = event.target.closest('[data-action="toggle-json-menu"]');
    if (toggleJsonMenuButton) {
        toggleJsonMenu();
        return;
    }

    const exportButton = event.target.closest('[data-action="export-json"]');
    if (exportButton) {
        closeJsonMenu();
        exportStateAsJson();
        return;
    }

    const importButton = event.target.closest('[data-action="import-json"]');
    if (importButton) {
        closeJsonMenu();
        jsonInput.click();
        return;
    }

    const exportCsvButton = event.target.closest('[data-action="export-csv"]');
    if (exportCsvButton) {
        closeJsonMenu();
        exportReportAsCsv();
        return;
    }

    const exportPdfButton = event.target.closest('[data-action="export-report-pdf"]');
    if (exportPdfButton) {
        closeJsonMenu();
        exportReportAsPdf();
        return;
    }

    const addSemesterButton = event.target.closest('[data-action="add-semester"]');
    if (addSemesterButton) {
        addSemester();
        return;
    }

    const addSubjectButton = event.target.closest('[data-action="add-subject"]');
    if (addSubjectButton) {
        addSubjectToSemester(addSubjectButton.dataset.semesterKey);
        return;
    }

    const askDeleteSemesterButton = event.target.closest('[data-action="ask-delete-semester"]');
    if (askDeleteSemesterButton) {
        askDeleteSemester(askDeleteSemesterButton.dataset.semesterKey);
        return;
    }

    const denyDeleteSemesterButton = event.target.closest('[data-action="deny-delete-semester"]');
    if (denyDeleteSemesterButton) {
        showToast("Chỉ học kỳ do bạn tạo trên web mới xóa được.", "error");
        return;
    }

    const closeModalButton = event.target.closest('[data-action="close-confirm-modal"]');
    if (closeModalButton) {
        closeDeleteSemesterModal();
        return;
    }

    const openGuideModalButton = event.target.closest('[data-action="open-guide-modal"]');
    if (openGuideModalButton) {
        openGuideModal();
        return;
    }

    const closeGuideModalButton = event.target.closest('[data-action="close-guide-modal"]');
    if (closeGuideModalButton) {
        closeGuideModal();
        return;
    }

    const closeMobileEditorButton = event.target.closest('[data-action="close-mobile-editor"]');
    if (closeMobileEditorButton) {
        closeMobileEditorSheet();
        renderDashboard();
        return;
    }

    const confirmModalButton = event.target.closest('[data-action="confirm-delete-semester"]');
    if (confirmModalButton) {
        confirmDeleteSemester();
        return;
    }

    const deleteSubjectButton = event.target.closest('[data-action="delete-subject"]');
    if (deleteSubjectButton) {
        deleteSubject(deleteSubjectButton.dataset.subjectId);
        return;
    }

    const semesterToggleButton = event.target.closest('[data-action="toggle-semester-confirm"]');
    if (semesterToggleButton) {
        const { semesterKey } = semesterToggleButton.dataset;
        const currentState = getSemesterState(semesterKey);
        const permissions = getSemesterPermissions(semesterKey);
        if (currentState.fixed === true) {
            showToast("Học kỳ đang ở trạng thái cố định.", "error");
            return;
        }
        if (permissions.canToggleLock !== true) {
            showToast("Học kỳ này không hỗ trợ khóa/mở khóa.", "error");
            return;
        }
        appState.semesterStates[semesterKey] = {
            confirmed: currentState.confirmed !== true,
            fixed: false,
            userCreated: currentState.userCreated === true,
        };
        appState.hasUnsavedChanges = false;
        persistLocalState();
        renderDashboard();
        return;
    }

    const toggleButton = event.target.closest('[data-action="toggle-editor"]');
    if (toggleButton) {
        const { subjectId } = toggleButton.dataset;
        if (isMobileViewport()) {
            appState.mobileEditorSubjectId = appState.mobileEditorSubjectId === subjectId ? null : subjectId;
            appState.openEditorSubjectId = null;
        } else {
            appState.openEditorSubjectId = appState.openEditorSubjectId === subjectId ? null : subjectId;
            appState.mobileEditorSubjectId = null;
        }
        renderDashboard();
        return;
    }

    const stepperButton = event.target.closest("[data-stepper]");
    if (!stepperButton || stepperButton.disabled) return;

    const subjectId = stepperButton.dataset.subjectId;
    const field = stepperButton.dataset.field;
    const delta = Number(stepperButton.dataset.delta);
    const subject = getSubjectById(subjectId);

    if (!subject || !Number.isFinite(delta)) return;

    const currentValue = parseNumericValue(subject[field]) ?? 0;
    const nextValue = normalizeInputValue(field, currentValue + delta);

    updatePredictionField(subjectId, field, nextValue, { skipMirror: false });

    const input = document.querySelector(
        `[data-subject-id="${subjectId}"][data-predict-field="${field}"]`
    );

    if (input) {
        input.value = formatEditableValue(field, getSubjectById(subjectId)[field]);
    }

    rebuildDerivedSubjects();
    renderDashboard();
}

async function handleUploadPdf() {
    const selectedFile = pdfInput.files[0];
    if (!selectedFile) {
        return;
    }

    const previousState = {
        currentFileName: appState.currentFileName,
        dataOrigin: appState.dataOrigin,
        sourceSubjects: appState.sourceSubjects,
        semesterStates: appState.semesterStates,
        gradeType: appState.gradeType,
    };

    appState.currentFileName = selectedFile.name;
    appState.dataOrigin = "pdf";
    updateUploadLabel();
    semesterContainer.innerHTML = `
        <section class="empty-state">
            <h2>Đang đọc bảng điểm</h2>
            <p>Hệ thống đang đọc trực tiếp file PDF trên trình duyệt.</p>
        </section>
    `;

    try {
        if (!gradePdfParser?.parseGradePdfFile) {
            throw new Error("Trình phân tích PDF chưa sẵn sàng.");
        }

        const allSubjects = await gradePdfParser.parseGradePdfFile(selectedFile);

        if (!Array.isArray(allSubjects)) {
            throw new Error("Dữ liệu parser không đúng định dạng.");
        }

        if (!allSubjects.length) {
            throw new Error("Không đọc được môn học từ file PDF này.");
        }

        appState.sourceSubjects = allSubjects.map((subject, index) => normalizeIncomingSubject(subject, index));
        appState.semesterStates = buildSemesterStatesFromPdf(appState.sourceSubjects);
        appState.hasUnsavedChanges = false;
        appState.openEditorSubjectId = null;
        rebuildDerivedSubjects();
        persistLocalState();
        renderDashboard();
        showToast("Đã nạp PDF. Các học kỳ từ PDF được khóa.", "success");
    } catch (error) {
        appState.currentFileName = previousState.currentFileName;
        appState.dataOrigin = previousState.dataOrigin;
        appState.sourceSubjects = previousState.sourceSubjects;
        appState.semesterStates = previousState.semesterStates;
        appState.gradeType = previousState.gradeType;
        rebuildDerivedSubjects();
        renderDashboard();
        showToast(error.message || "Lỗi đọc PDF.", "error");
    } finally {
        pdfInput.value = "";
    }
}

async function initializeApp() {
    initializeTopAreaToggle();
    if (!await hydrateFromLocalState()) {
        rebuildDerivedSubjects();
    }

    renderFeatureTabs();
    renderDashboard();
}

initializeApp();
