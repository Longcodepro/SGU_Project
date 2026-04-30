// Render một metric trong khối tổng quan.
function renderMetricItem(label, value, isMuted = false) {
    return `
        <li class="metric-item">
            <span class="metric-item__label">- ${escapeHtml(label)}:</span>
            <span class="metric-item__value${isMuted ? " is-muted" : ""}">${escapeHtml(value)}</span>
        </li>
    `;
}

// Render một metric trong khối tóm tắt học kỳ.
function renderSummaryItem(label, value, isMuted = false) {
    return `
        <div class="summary-item">
            <span class="summary-item__label">- ${escapeHtml(label)}:</span>
            <span class="summary-item__value${isMuted ? " is-muted" : ""}">${escapeHtml(value)}</span>
        </div>
    `;
}

// Trả về ký hiệu kết quả đạt/rớt của môn.
function getResultMark(subject) {
    if (!hasResolvedGrade(subject)) {
        return '<span class="status-mark status-mark--pending">--</span>';
    }

    if (subject.passed === true) {
        return '<span class="status-mark status-mark--pass">✓</span>';
    }

    if (subject.passed === false) {
        return '<span class="status-mark status-mark--fail">×</span>';
    }

    return Number(subject.diem_he_10) >= 4
        ? '<span class="status-mark status-mark--pass">✓</span>'
        : '<span class="status-mark status-mark--fail">×</span>';
}

// Hiển thị badge trạng thái của môn học.
function renderSubjectMeta(subject) {
    if (isExcludedSubject(subject)) {
        return '<div class="subject-name__meta"><span class="subject-badge subject-badge--excluded">Ngoài GPA</span></div>';
    }

    if (subject.da_co_diem !== true) {
        return '<div class="subject-name__meta"><span class="subject-badge subject-badge--waiting">Chưa có điểm</span></div>';
    }

    return "";
}

// Render một control nhập liệu (điểm/trọng số) có nút +/-.
function renderPredictionControl(subject, config, isReadOnly) {
    const disabledAttr = isReadOnly ? "disabled" : "";

    return `
        <label class="control-field">
            <span class="control-field__label">${escapeHtml(config.label)}</span>
            <span class="control-field__input">
                <button
                    class="control-stepper"
                    type="button"
                    data-stepper="true"
                    data-subject-id="${escapeHtml(subject.__id)}"
                    data-field="${escapeHtml(config.field)}"
                    data-delta="${escapeHtml(config.minusDelta)}"
                    ${disabledAttr}
                >
                    -
                </button>
                <input
                    type="number"
                    inputmode="decimal"
                    min="${escapeHtml(config.min)}"
                    max="${escapeHtml(config.max)}"
                    step="${escapeHtml(config.step)}"
                    value="${escapeHtml(formatEditableValue(config.field, subject[config.field]))}"
                    data-predict-field="${escapeHtml(config.field)}"
                    data-subject-id="${escapeHtml(subject.__id)}"
                    ${disabledAttr}
                >
                <button
                    class="control-stepper"
                    type="button"
                    data-stepper="true"
                    data-subject-id="${escapeHtml(subject.__id)}"
                    data-field="${escapeHtml(config.field)}"
                    data-delta="${escapeHtml(config.plusDelta)}"
                    ${disabledAttr}
                >
                    +
                </button>
            </span>
        </label>
    `;
}

// Render field sửa thông tin cơ bản của môn.
function renderBasicEditField(subject, config, isReadOnly) {
    const value = config.field === "so_tin_chi"
        ? formatEditableValue(config.field, subject[config.field])
        : String(subject[config.field] || "");

    return `
        <label class="basic-edit-field">
            <span class="basic-edit-field__label">${escapeHtml(config.label)}</span>
            <input
                class="basic-edit-field__input"
                type="${escapeHtml(config.type)}"
                value="${escapeHtml(value)}"
                ${config.min ? `min="${escapeHtml(config.min)}"` : ""}
                ${config.max ? `max="${escapeHtml(config.max)}"` : ""}
                ${config.step ? `step="${escapeHtml(config.step)}"` : ""}
                data-basic-field="${escapeHtml(config.field)}"
                data-subject-id="${escapeHtml(subject.__id)}"
                ${isReadOnly ? "disabled" : ""}
            >
        </label>
    `;
}

// Render hàng mở rộng khi bấm Sửa/Xem môn học.
function renderPredictionRow(subject) {
    const isReadOnly = isSemesterConfirmed(subject.hoc_ky);
    const permissions = getSemesterPermissions(subject.hoc_ky);
    const footerText = isReadOnly
        ? "Học kỳ đã khóa, chỉ xem chi tiết."
        : canApplyPrediction(subject)
            ? "Đã đủ dữ liệu. Hệ thống tự động tính lại bảng điểm."
            : "Nhập điểm + trọng số hợp lệ (tổng 100%) để tính dự đoán.";

    return `
        <tr class="prediction-row">
            <td colspan="10">
                <div class="prediction-panel prediction-panel--compact">
                    <div class="prediction-panel__header">
                        <div class="prediction-panel__title">${isReadOnly ? "Chi tiết môn học" : "Sửa nhanh thông tin môn học"}</div>
                        <div class="prediction-panel__hint">Bố cục gọn cho desktop và mobile.</div>
                    </div>

                    <div class="basic-edit-grid">
                        ${renderBasicEditField(subject, { field: "ma_mon", label: "Mã môn", type: "text" }, isReadOnly)}
                        ${renderBasicEditField(subject, { field: "ten_mon", label: "Tên môn", type: "text" }, isReadOnly)}
                        ${renderBasicEditField(subject, { field: "so_tin_chi", label: "Số tín chỉ", type: "number", min: "0", max: "30", step: "1" }, isReadOnly)}
                    </div>

                    <div class="prediction-grid">
                        ${renderPredictionControl(subject, {
                            field: "diem_kiem_tra",
                            label: "Điểm kiểm tra",
                            min: "0",
                            max: "10",
                            step: "0.1",
                            minusDelta: "-0.1",
                            plusDelta: "0.1",
                        }, isReadOnly)}
                        ${renderPredictionControl(subject, {
                            field: "diem_thi",
                            label: "Điểm thi",
                            min: "0",
                            max: "10",
                            step: "0.1",
                            minusDelta: "-0.1",
                            plusDelta: "0.1",
                        }, isReadOnly)}
                        ${renderPredictionControl(subject, {
                            field: "trong_so_1",
                            label: "Trọng số kiểm tra (%)",
                            min: "0",
                            max: "100",
                            step: "10",
                            minusDelta: "-10",
                            plusDelta: "10",
                        }, isReadOnly)}
                        ${renderPredictionControl(subject, {
                            field: "trong_so_2",
                            label: "Trọng số thi (%)",
                            min: "0",
                            max: "100",
                            step: "10",
                            minusDelta: "-10",
                            plusDelta: "10",
                        }, isReadOnly)}
                    </div>

                    <div class="prediction-panel__footer">
                        ${!isReadOnly && permissions.canDeleteSubject === true ? `
                            <button
                                class="delete-subject-button"
                                type="button"
                                data-action="delete-subject"
                                data-subject-id="${escapeHtml(subject.__id)}"
                            >
                                Xóa môn
                            </button>
                        ` : ""}
                        <div class="prediction-panel__note">
                            <strong>Lưu ý:</strong> ${escapeHtml(footerText)}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

// Render nút thao tác của một môn.
function renderActionCell(subject) {
    if (!isPredictableSubject(subject)) {
        return '<span class="action-placeholder"></span>';
    }

    const permissions = getSemesterPermissions(subject.hoc_ky);
    if (permissions.canEditSubject !== true) {
        return '<button class="action-toggle is-locked" type="button" disabled>Sửa</button>';
    }

    const isOpen = appState.openEditorSubjectId === subject.__id;
    const isConfirmed = isSemesterConfirmed(subject.hoc_ky);
    const classNames = [
        "action-toggle",
        isOpen ? "is-active" : "",
        isConfirmed ? "is-locked" : "",
    ].filter(Boolean).join(" ");
    const label = isOpen
        ? "Đóng"
        : isConfirmed
            ? "Xem"
            : "Sửa";

    return `
        <button
            class="${classNames}"
            type="button"
            data-action="toggle-editor"
            data-subject-id="${escapeHtml(subject.__id)}"
        >
            ${escapeHtml(label)}
        </button>
    `;
}

// Render một hàng môn học.
function renderSubjectRow(subject, index) {
    const score10 = hasResolvedGrade(subject) ? formatNumber(subject.diem_he_10, 1) : "--";
    const score4 = hasResolvedGrade(subject) ? formatNumber(subject.diem_he_4, 1) : "--";
    const letter = hasResolvedGrade(subject)
        ? (subject.diem_chu || convert10toLetter(subject.diem_he_10, appState.gradeType))
        : "--";
    const shouldOpenEditor = isPredictableSubject(subject) && appState.openEditorSubjectId === subject.__id;

    return `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(subject.ma_mon || "--")}</td>
            <td>${escapeHtml(subject.nhom || "01")}</td>
            <td class="subject-name">
                <span class="subject-name__title">${escapeHtml(subject.ten_mon || "Môn học mới")}</span>
                ${renderSubjectMeta(subject)}
            </td>
            <td>${escapeHtml(formatInteger(subject.so_tin_chi))}</td>
            <td>${escapeHtml(score10)}</td>
            <td>${escapeHtml(score4)}</td>
            <td>${escapeHtml(letter)}</td>
            <td>${getResultMark(subject)}</td>
            <td class="action-cell">${renderActionCell(subject)}</td>
        </tr>
        ${shouldOpenEditor ? renderPredictionRow(getSubjectById(subject.__id) || subject) : ""}
    `;
}

// Render hàng + Thêm môn.
function renderAddSubjectRow(semesterKey) {
    const permissions = getSemesterPermissions(semesterKey);
    if (isSemesterConfirmed(semesterKey) || permissions.canAddSubject !== true) {
        return `
            <tr class="add-subject-row">
                <td colspan="10">
                    <button class="add-subject-button is-disabled" type="button" disabled>
                        + Thêm môn
                    </button>
                </td>
            </tr>
        `;
    }

    return `
        <tr class="add-subject-row">
            <td colspan="10">
                <button class="add-subject-button" type="button" data-action="add-subject" data-semester-key="${escapeHtml(semesterKey)}">
                    + Thêm môn
                </button>
            </td>
        </tr>
    `;
}

// Kiểm tra học kỳ có quyền xóa hay không.
function canDeleteSemester(semesterKey) {
    return getSemesterPermissions(semesterKey).canDeleteSemester === true;
}

// Render nút khóa/hủy khóa học kỳ.
function renderSemesterConfirmButton(semesterKey, subjects) {
    const semesterState = getSemesterState(semesterKey);
    const permissions = getSemesterPermissions(semesterKey);
    if (semesterState.fixed === true) {
        return '<span class="semester-title__meta">Đã khóa từ bảng điểm</span>';
    }

    if (!semesterHasEditableSubjects(subjects) || permissions.canToggleLock !== true) {
        return "";
    }

    const confirmed = semesterState.confirmed === true;

    return `
        <button
            class="semester-confirm${confirmed ? " is-confirmed" : ""}"
            type="button"
            data-action="toggle-semester-confirm"
            data-semester-key="${escapeHtml(semesterKey)}"
        >
            ${confirmed ? "Hủy khóa" : "Khóa"}
        </button>
    `;
}

// Render nút xóa học kỳ theo quyền.
function renderSemesterDeleteButton(semesterKey) {
    const permissions = getSemesterPermissions(semesterKey);
    if (canDeleteSemester(semesterKey)) {
        return `
            <button
                class="semester-delete"
                type="button"
                data-action="ask-delete-semester"
                data-semester-key="${escapeHtml(semesterKey)}"
            >
                Xóa kỳ
            </button>
        `;
    }

    if (permissions.dimDeleteButton === true) {
        return `
            <button class="semester-delete is-disabled" type="button" disabled>
                Xóa kỳ
            </button>
        `;
    }

    return `
        <button class="semester-delete" type="button" data-action="deny-delete-semester" data-semester-key="${escapeHtml(semesterKey)}">
            Xóa kỳ
        </button>
    `;
}

// Gom tín chỉ theo điểm chữ để vẽ biểu đồ.
function calculateDistributionCredits(subjects) {
    const config = getDistributionConfigByGradeType(appState.gradeType);
    const allowed = new Set(config.map((item) => item.key));
    const credits = {};
    config.forEach((item) => {
        credits[item.key] = 0;
    });

    (subjects || []).forEach((subject) => {
        if (!isEligibleForGPA(subject)) return;
        const letter = String(subject.diem_chu || "").trim().toUpperCase();
        if (!allowed.has(letter)) return;
        credits[letter] += parseNumericValue(subject.so_tin_chi) ?? 0;
    });

    return credits;
}

// Render biểu đồ phân bố điểm chữ.
function renderDistributionBlock(creditBuckets) {
    const config = getDistributionConfigByGradeType(appState.gradeType);
    const totalCredits = config.reduce((sum, item) => sum + (creditBuckets[item.key] || 0), 0);

    if (totalCredits <= 0) {
        return '<div class="grade-distribution__empty">Chưa có dữ liệu điểm để vẽ biểu đồ.</div>';
    }

    let running = 0;
    const segments = config.map((item) => {
        const value = creditBuckets[item.key] || 0;
        const percentage = (value / totalCredits) * 100;
        const start = running;
        running += percentage;
        return { ...item, value, percentage, start, end: running };
    });

    const gradient = segments
        .filter((segment) => segment.value > 0)
        .map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`)
        .join(", ");

    const callouts = segments
        .filter((segment) => segment.value > 0 && segment.percentage >= 5)
        .map((segment) => {
            const mid = ((segment.start + segment.end) / 2) * (Math.PI * 2 / 100) - (Math.PI / 2);
            const x1 = 120 + Math.cos(mid) * 82;
            const y1 = 120 + Math.sin(mid) * 82;
            const x2 = 120 + Math.cos(mid) * 102;
            const y2 = 120 + Math.sin(mid) * 102;
            const rightSide = Math.cos(mid) >= 0;
            const x3 = x2 + (rightSide ? 16 : -16);
            const y3 = y2;
            const tx = x3 + (rightSide ? 4 : -4);
            const textAnchor = rightSide ? "start" : "end";

            return `
                <g class="pie-callout">
                    <line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"></line>
                    <line x1="${x2.toFixed(2)}" y1="${y2.toFixed(2)}" x2="${x3.toFixed(2)}" y2="${y3.toFixed(2)}"></line>
                    <text x="${tx.toFixed(2)}" y="${(y3 + 4).toFixed(2)}" text-anchor="${textAnchor}">${segment.key}(${formatInteger(segment.value)} tín chỉ)</text>
                </g>
            `;
        })
        .join("");

    return `
        <div class="grade-distribution">
            <div class="pie-chart-wrap">
                <div class="pie-chart" style="background: conic-gradient(${gradient});">
                    <svg class="pie-callout-layer" viewBox="0 0 240 240" aria-hidden="true">
                        ${callouts}
                    </svg>
                </div>
            </div>
        </div>
    `;
}

// Render khối tổng quan tích lũy.
function renderOverview(cumulative = {}, creditBuckets = null) {
    const cumulativeHasData = cumulative?.co_du_lieu === true;
    const distributionCredits = creditBuckets || calculateDistributionCredits([]);

    overviewPanel.innerHTML = `
        <div class="overview-column">
            <ul class="metric-list">
                ${renderMetricItem("Điểm tích lũy hệ 4", cumulativeHasData ? formatNumber(cumulative.gpa4, 2) : "--", !cumulativeHasData)}
                ${renderMetricItem("Điểm tích lũy hệ 10", cumulativeHasData ? formatNumber(cumulative.gpa10, 2) : "--", !cumulativeHasData)}
                ${renderMetricItem("Số tín chỉ tích lũy", cumulativeHasData ? formatInteger(cumulative.tong_tin) : "--", !cumulativeHasData)}
                ${renderMetricItem("Xếp loại", cumulativeHasData ? classifyGraduation(cumulative.gpa4) : "--", !cumulativeHasData)}
            </ul>
        </div>
        <div class="overview-column">
            ${renderDistributionBlock(distributionCredits)}
        </div>
    `;
}

// Render section của một học kỳ.
function createSemesterSection(semesterKey, subjects, semesterSummary, cumulativeSummary) {
    const subjectRows = subjects.length
        ? subjects.map((subject, index) => renderSubjectRow(subject, index)).join("")
        : `
            <tr>
                <td colspan="10" class="semester-empty-cell">Học kỳ này chưa có môn học.</td>
            </tr>
        `;

    return `
        <section class="semester-section">
            <h2 class="semester-title">
                <span>${escapeHtml(semesterKey)}</span>
                <span class="semester-title__actions">
                    ${renderSemesterConfirmButton(semesterKey, subjects)}
                    ${renderSemesterDeleteButton(semesterKey)}
                </span>
            </h2>

            <div class="semester-table-wrap">
                <table class="semester-table">
                    <colgroup>
                        <col style="width: 56px">
                        <col style="width: 126px">
                        <col style="width: 78px">
                        <col>
                        <col style="width: 82px">
                        <col style="width: 92px">
                        <col style="width: 92px">
                        <col style="width: 82px">
                        <col style="width: 74px">
                        <col style="width: 108px">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>STT</th>
                            <th>Mã môn</th>
                            <th>Nhóm</th>
                            <th>Tên môn</th>
                            <th>Tín chỉ</th>
                            <th>Hệ 10</th>
                            <th>Hệ 4</th>
                            <th>Chữ</th>
                            <th>KQ</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subjectRows}
                        ${renderAddSubjectRow(semesterKey)}
                    </tbody>
                </table>
            </div>

            <div class="summary-strip">
                <div class="summary-block">
                    ${renderSummaryItem("Điểm trung bình học kỳ hệ 4", semesterSummary.co_du_lieu ? formatNumber(semesterSummary.gpa4, 2) : "--", !semesterSummary.co_du_lieu)}
                    ${renderSummaryItem("Điểm trung bình học kỳ hệ 10", semesterSummary.co_du_lieu ? formatNumber(semesterSummary.gpa10, 2) : "--", !semesterSummary.co_du_lieu)}
                    ${renderSummaryItem("Số tín chỉ đạt học kỳ", semesterSummary.co_du_lieu ? formatInteger(semesterSummary.tong_tin) : "--", !semesterSummary.co_du_lieu)}
                    ${renderSummaryItem("Xếp loại học kỳ", semesterSummary.co_du_lieu ? classifySemesterAcademic(semesterSummary.gpa4) : "--", !semesterSummary.co_du_lieu)}
                </div>
                <div class="summary-block">
                    ${renderSummaryItem("Điểm trung bình tích lũy hệ 4", cumulativeSummary.co_du_lieu ? formatNumber(cumulativeSummary.gpa4, 2) : "--", !cumulativeSummary.co_du_lieu)}
                    ${renderSummaryItem("Điểm trung bình tích lũy hệ 10", cumulativeSummary.co_du_lieu ? formatNumber(cumulativeSummary.gpa10, 2) : "--", !cumulativeSummary.co_du_lieu)}
                    ${renderSummaryItem("Số tín chỉ tích lũy", cumulativeSummary.co_du_lieu ? formatInteger(cumulativeSummary.tong_tin) : "--", !cumulativeSummary.co_du_lieu)}
                </div>
            </div>
        </section>
    `;
}

// Render trạng thái rỗng khi chưa có dữ liệu.
function renderEmptyState(message) {
    semesterContainer.innerHTML = `
        <section class="empty-state">
            <h2>Chưa có dữ liệu bảng điểm</h2>
            <p>${escapeHtml(message)}</p>
        </section>
    `;
}

// Render toàn bộ dashboard bảng điểm.
function renderDashboard() {
    updateUploadLabel();
    syncGlobalGradeSwitch();

    if (!Object.keys(appState.semesterStates).length) {
        appState.semesterStates = buildSemesterStates(appState.sourceSubjects, appState.semesterStates);
    }

    if (!appState.sourceSubjects.length && !Object.keys(appState.semesterStates).length) {
        renderOverview();
        renderEmptyState("Hãy chọn file PDF, nhập JSON hoặc bấm Thêm học kỳ để lập kế hoạch.");
        renderGraduationPlanner();
        return;
    }

    const sourceResolved = resolveRetakes(appState.sourceSubjects);
    const tableResolved = resolveRetakes(appState.viewSubjects);
    const summaryResolved = resolveRetakes(appState.summarySubjects);
    const semesterKeys = sortSemesterKeys(
        Array.from(new Set([
            ...Object.keys(appState.semesterStates),
            ...Object.keys(sourceResolved.byHocKy),
            ...Object.keys(tableResolved.byHocKy),
            ...Object.keys(summaryResolved.byHocKy),
        ])),
        "desc"
    );

    const cumulativeBySemester = {};
    let accumulatedSubjects = [];

    sortSemesterKeys(semesterKeys, "asc").forEach((semesterKey) => {
        accumulatedSubjects = [...accumulatedSubjects, ...(summaryResolved.byHocKy[semesterKey] || [])];
        cumulativeBySemester[semesterKey] = calculateCumulativeGPAFull(accumulatedSubjects);
    });

    const confirmedSubjects = appState.summarySubjects.filter((subject) => isSemesterConfirmed(subject.hoc_ky));
    const finalCumulative = calculateCumulativeGPAFull(confirmedSubjects);
    const confirmedResolved = resolveRetakes(confirmedSubjects);
    const bestForDistribution = confirmedResolved.forCumulative || [];
    const creditBuckets = calculateDistributionCredits(bestForDistribution);
    renderOverview(finalCumulative, creditBuckets);

    semesterContainer.innerHTML = semesterKeys.map((semesterKey) => {
        const subjects = tableResolved.byHocKy[semesterKey] || sourceResolved.byHocKy[semesterKey] || [];
        const semesterSummary = calculateSemesterGPA(summaryResolved.byHocKy[semesterKey] || []);
        const cumulativeSummary = cumulativeBySemester[semesterKey] || {
            gpa10: 0,
            gpa4: 0,
            tong_tin: 0,
            tong_tin_tinh_gpa: 0,
            co_du_lieu: false,
        };

        return createSemesterSection(
            semesterKey,
            subjects,
            semesterSummary,
            cumulativeSummary
        );
    }).join("");

    renderGraduationPlanner();
}
