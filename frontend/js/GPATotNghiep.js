// Khai báo các mốc xếp loại tốt nghiệp theo GPA hệ 4.
function getGraduationTargets() {
    return [
        { key: "trung-binh", label: "Trung bình", minScore: 2.0 },
        { key: "kha", label: "Khá", minScore: 2.5 },
        { key: "gioi", label: "Giỏi", minScore: 3.2 },
        { key: "xuat-sac", label: "Xuất sắc", minScore: 3.6 },
    ];
}

// Lấy ngưỡng thấp nhất của xếp loại hiện tại.
function getCurrentGraduationFloorScore(gpa4) {
    const score = parseNumericValue(gpa4) ?? 0;
    if (score >= 3.6) return 3.6;
    if (score >= 3.2) return 3.2;
    if (score >= 2.5) return 2.5;
    if (score >= 2.0) return 2.0;
    return null;
}

// Chỉ giữ mức hiện tại và các mức cao hơn để lập kế hoạch.
function getRelevantGraduationTargets(currentGpa4) {
    const floorScore = getCurrentGraduationFloorScore(currentGpa4);
    if (floorScore === null) {
        return getGraduationTargets();
    }
    return getGraduationTargets().filter((target) => target.minScore >= floorScore);
}

// Tính phân bổ tối thiểu theo thứ tự điểm chữ cao -> thấp, tổng luôn bằng tín còn lại.
function buildSequentialGradePlan(params) {
    const { currentGpa4, currentCredits, remainingCredits, target, gradeType } = params;
    const levels = getPassingGradeLevels(gradeType);
    const allocation = {};
    levels.forEach((level) => {
        allocation[level.key] = 0;
    });

    const cappedRemaining = Math.max(0, Math.round(Number(remainingCredits) || 0));
    const currentPoints = (parseNumericValue(currentGpa4) ?? 0) * (parseNumericValue(currentCredits) ?? 0);
    const targetTotalPoints = target.minScore * ((parseNumericValue(currentCredits) ?? 0) + cappedRemaining);

    if (!levels.length) {
        return { possible: false, allocation };
    }

    if (cappedRemaining === 0) {
        return {
            possible: currentPoints + 1e-9 >= targetTotalPoints,
            allocation,
        };
    }

    const topPoint = levels[0].point;
    if (currentPoints + cappedRemaining * topPoint + 1e-9 < targetTotalPoints) {
        allocation[levels[0].key] = cappedRemaining;
        return { possible: false, allocation };
    }

    let assignedCredits = 0;
    let assignedPoints = 0;

    for (let index = 0; index < levels.length - 1; index += 1) {
        const current = levels[index];
        const support = levels[index + 1];
        const creditsLeft = cappedRemaining - assignedCredits;
        const numerator = targetTotalPoints - currentPoints - assignedPoints - creditsLeft * support.point;
        const denominator = current.point - support.point;
        const rawNeed = numerator <= 0 ? 0 : Math.ceil((numerator / denominator) - 1e-9);
        const need = Math.max(0, Math.min(creditsLeft, rawNeed));

        allocation[current.key] = need;
        assignedCredits += need;
        assignedPoints += need * current.point;
    }

    const last = levels[levels.length - 1];
    allocation[last.key] = Math.max(0, cappedRemaining - assignedCredits);
    assignedPoints += allocation[last.key] * last.point;

    const finalPoints = currentPoints + assignedPoints;
    const possible = finalPoints + 1e-9 >= targetTotalPoints;

    return { possible, allocation };
}

// Lấy GPA hiện tại từ các học kỳ đã khóa.
function getConfirmedCumulativeSummary() {
    const confirmedSubjects = appState.summarySubjects.filter((subject) => isSemesterConfirmed(subject.hoc_ky));
    const cumulative = calculateCumulativeGPAFull(confirmedSubjects);
    return {
        cumulative,
        currentCredits: cumulative?.tong_tin_tinh_gpa || 0,
        currentGpa4: cumulative?.gpa4 || 0,
    };
}

// Render giao diện lập kế hoạch GPA tốt nghiệp.
function renderGraduationPlanner() {
    if (!graduationPlannerPanel) return;

    const { cumulative, currentCredits, currentGpa4 } = getConfirmedCumulativeSummary();
    const hasCurrentData = cumulative?.co_du_lieu === true;
    const totalProgramCredits = Math.max(0, parseProgramCreditInput(appState.totalProgramCredits));
    const remainingCredits = Math.max(0, totalProgramCredits - currentCredits);
    const currentRank = hasCurrentData ? classifyGraduation(currentGpa4) : "--";
    const targets = hasCurrentData ? getRelevantGraduationTargets(currentGpa4) : getGraduationTargets();
    const currentFloorScore = hasCurrentData ? getCurrentGraduationFloorScore(currentGpa4) : null;
    const gradeLevels = getPassingGradeLevels(appState.gradeType);

    const rowHtml = targets.map((target) => {
        if (!hasCurrentData) {
            return `
                <article class="graduation-goal-card">
                    <h3 class="graduation-goal-card__title">Mục tiêu: ${escapeHtml(target.label)} (&gt;= ${formatNumber(target.minScore, 2)})</h3>
                    <p class="graduation-goal-card__text is-muted">Cần có dữ liệu GPA tích lũy từ các học kỳ đã khóa để bắt đầu tính.</p>
                </article>
            `;
        }

        const isCurrentLevel = currentFloorScore !== null && Math.abs(target.minScore - currentFloorScore) < 1e-9;
        const plan = buildSequentialGradePlan({
            currentGpa4,
            currentCredits,
            remainingCredits,
            target,
            gradeType: appState.gradeType,
        });

        const levelRows = gradeLevels.map((level) => {
            const value = plan.allocation?.[level.key] ?? 0;
            return `<p class="graduation-goal-card__text"><strong>${escapeHtml(level.key)}:</strong> cần đạt tối thiểu ${formatInteger(value)} tín chỉ.</p>`;
        }).join("");

        return `
            <article class="graduation-goal-card">
                <h3 class="graduation-goal-card__title">${isCurrentLevel ? "Duy trì" : "Mục tiêu"}: ${escapeHtml(target.label)} (&gt;= ${formatNumber(target.minScore, 2)})</h3>
                ${levelRows}
                ${plan.possible
                    ? ""
                    : '<p class="graduation-goal-card__text is-danger">Không thể đạt mốc này với số tín chỉ còn lại hiện tại.</p>'
                }
            </article>
        `;
    }).join("");

    graduationPlannerPanel.innerHTML = `
        <h2 class="graduation-planner-panel__title">Tính GPA tốt nghiệp</h2>
        <section class="graduation-planner-form">
            <label class="graduation-planner-form__field">
                <span class="graduation-planner-form__label">Tổng tín chỉ toàn khóa</span>
                <input
                    class="graduation-planner-form__input"
                    type="number"
                    min="0"
                    step="1"
                    value="${totalProgramCredits > 0 ? formatInteger(totalProgramCredits) : ""}"
                    placeholder="Ví dụ: 130"
                    data-action="update-program-credits"
                >
            </label>
            <div class="graduation-planner-metrics">
                <p><strong>GPA tích lũy hiện tại:</strong> ${hasCurrentData ? formatNumber(currentGpa4, 2) : "--"} (${escapeHtml(currentRank)})</p>
                <p><strong>Tín chỉ đã tính GPA:</strong> ${hasCurrentData ? formatInteger(currentCredits) : 0}</p>
                <p><strong>Tín chỉ còn lại:</strong> ${formatInteger(remainingCredits)}</p>
            </div>
        </section>
        <section class="graduation-goal-list">
            ${rowHtml}
        </section>
    `;
}
