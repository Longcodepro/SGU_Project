// Lấy danh sách mức điểm chữ theo thang hiện tại.
function getGradeLevelsByType(gradeType = "type1") {
    const scheme = getGradeScheme(gradeType);
    return (scheme?.thresholds || []).map((item) => ({
        key: String(item.letter || "").trim().toUpperCase(),
        point: Number(item.point4 || 0),
    }));
}

// Quy đổi trạng thái thanh gạt sang mã thang điểm.
function resolveGradeTypeBySwitch(checked) {
    return checked ? "type2" : "type1";
}

// Lấy các mức điểm đậu (không gồm F), sắp từ cao xuống thấp.
function getPassingGradeLevels(gradeType = "type1") {
    return getGradeLevelsByType(gradeType).filter((item) => item.point > 0);
}

// Trả về cấu hình màu cho biểu đồ phân bố điểm chữ.
function getDistributionConfigByGradeType(gradeType = "type1") {
    const colorMap = {
        A: "#2b8a3e",
        "B+": "#2f9e44",
        B: "#74b816",
        "C+": "#f08c00",
        C: "#f76707",
        "D+": "#e8590c",
        D: "#d9480f",
        F: "#c92a2a",
    };

    return getGradeLevelsByType(gradeType).map((item) => ({
        key: item.key,
        color: colorMap[item.key] || "#868e96",
    }));
}
