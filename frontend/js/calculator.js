// Các mã môn học không tính vào GPA.
const EXCLUDED_MA_MON = new Set([
  "862406", "862407", "862408", "862409",
  "862101",
]);

// Các từ khóa tên môn học không tính vào GPA.
const EXCLUDED_NAME_KEYWORDS = [
  "bong chuyen",
  "cau long",
  "bong da",
  "the duc",
  "giao duc the chat",
  "quoc phong",
  "giao duc quoc phong",
];

// Các bộ thang điểm quy đổi.
const GRADE_SCHEMES = {
  // Dạng 1 (label: K24 trở lên).
  type1: {
    id: "type1",
    label: "K24 tro len",
    thresholds: [
      { min: 8.5, letter: "A", point4: 4.0 },
      { min: 7.0, letter: "B", point4: 3.0 },
      { min: 5.5, letter: "C", point4: 2.0 },
      { min: 4.0, letter: "D", point4: 1.0 },
      { min: 0, letter: "F", point4: 0.0 },
    ],
  },
  // Dạng 2 (label: K25 trở về).
  type2: {
    id: "type2",
    label: "K25 tro ve",
    thresholds: [
      { min: 8.5, letter: "A", point4: 4.0 },
      { min: 7.8, letter: "B+", point4: 3.5 },
      { min: 7.0, letter: "B", point4: 3.0 },
      { min: 6.3, letter: "C+", point4: 2.5 },
      { min: 5.5, letter: "C", point4: 2.0 },
      { min: 4.8, letter: "D+", point4: 1.5 },
      { min: 4.0, letter: "D", point4: 1.0 },
      { min: 0, letter: "F", point4: 0.0 },
    ],
  },
};

// Chọn dạng thang điểm 1 hoặc 2.
// Chọn thang điểm theo `gradeType`; nếu không hợp lệ thì dùng `type1`.
function getGradeScheme(gradeType = "type1") {
  // Trả về cấu hình thang điểm đang áp dụng.
  return GRADE_SCHEMES[gradeType] || GRADE_SCHEMES.type1;
}

// Chuyển hệ 10 sang hệ 4 và điểm chữ theo thang đã chọn.
// Quy đổi điểm hệ 10 sang hệ 4 + điểm chữ theo thang đã chọn.
function resolveGradeBy10(diem10, gradeType = "type1") {
  // Chuẩn hóa dữ liệu đầu vào về số.
  const score = parseNumericValue(diem10);
  if (score === null) {
    // Không có điểm hợp lệ thì trả giá trị mặc định.
    return {
      point4: 0,
      letter: "--",
    };
  }
  // Tìm ngưỡng điểm phù hợp trong thang đã chọn.
  const scheme = getGradeScheme(gradeType);
  const matched = scheme.thresholds.find((item) => score >= item.min) || scheme.thresholds[scheme.thresholds.length - 1];

  return {
    point4: matched.point4,
    letter: matched.letter,
  };
}

// Chuẩn hóa chuỗi để so khớp không phân biệt dấu/chữ hoa-thường.
function normalizeText(value) {
  // Bỏ dấu, chuẩn hóa đ/Đ, hạ chữ thường và trim.
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .trim();
}

// Ép giá trị bất kỳ sang số; không hợp lệ thì trả `null`.
function parseNumericValue(value) {
  // Chặn sớm các giá trị rỗng để tránh NaN.
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Giới hạn giá trị số trong đoạn [min, max].
function clampNumber(value, min, max) {
  // Nếu không parse được số thì trả null.
  const numericValue = parseNumericValue(value);
  if (numericValue === null) return null;
  return Math.min(max, Math.max(min, numericValue));
}

// Làm tròn điểm thành phần theo quy tắc >= .5 thì lên 1.
function roundComponentScore(score) {
  // Dùng phần thập phân để quyết định làm tròn.
  const numericScore = parseNumericValue(score) ?? 0;
  const decimal = numericScore - Math.floor(numericScore);
  return decimal >= 0.5 ? Math.floor(numericScore) + 1 : Math.floor(numericScore);
}

// Làm tròn GPA đến 2 chữ số thập phân.
function roundGPA(value) {
  // Null thì quy về 0 để tránh lan truyền NaN.
  const numericValue = parseNumericValue(value);
  if (numericValue === null) return 0;
  return Math.round((numericValue + 1e-8) * 100) / 100;
}

// Quy đổi điểm hệ 10 sang hệ 4.
function convert10to4(diem10, gradeType = "type1") {
  // Tái sử dụng hàm quy đổi trung tâm.
  return resolveGradeBy10(diem10, gradeType).point4;
}

// Quy đổi điểm hệ 10 sang điểm chữ.
function convert10toLetter(diem10, gradeType = "type1") {
  // Tái sử dụng hàm quy đổi trung tâm.
  return resolveGradeBy10(diem10, gradeType).letter;
}

// Quy đổi điểm hệ 4 sang điểm chữ (map cố định).
function convert4toLetter(diem4) {
  // Ánh xạ trực tiếp theo các mốc hệ 4.
  const map = { 0: "F", 1: "D", 2: "C", 3: "B", 4: "A" };
  return map[parseNumericValue(diem4)] ?? "F";
}

// Kiểm tra môn học có thuộc nhóm bị loại khỏi GPA hay không.
function isExcludedSubject(subject) {
  // Ưu tiên so theo mã môn, sau đó so theo từ khóa tên môn.
  const maMon = String(subject?.ma_mon ?? "").trim();
  const tenMon = normalizeText(subject?.ten_mon);

  if (EXCLUDED_MA_MON.has(maMon)) return true;
  return EXCLUDED_NAME_KEYWORDS.some((keyword) => tenMon.includes(keyword));
}

// Môn học đã có điểm chính thức từ PDF/dữ liệu gốc.
function hasOfficialGrade(subject) {
  // Chỉ true khi cờ da_co_diem được bật.
  return subject?.da_co_diem === true;
}

// Môn học đã được người dùng lưu dự đoán.
function hasSavedPrediction(subject) {
  // Dựa trên cờ prediction_saved.
  return subject?.prediction_saved === true;
}

// Môn học đang ở trạng thái điểm dự đoán.
function hasPredictedGrade(subject) {
  // Dựa trên cờ la_du_doan.
  return subject?.la_du_doan === true;
}

// Môn có điểm hợp lệ để đưa vào tính toán.
function hasResolvedGrade(subject) {
  // Không có môn thì không hợp lệ.
  if (!subject) return false;
  // Có điểm chính thức hoặc đang dự đoán thì chấp nhận ngay.
  if (hasOfficialGrade(subject) || hasPredictedGrade(subject)) return true;

  // Fallback: cần đủ cả điểm hệ 10 và hệ 4.
  const diem10 = parseNumericValue(subject.diem_he_10);
  const diem4 = parseNumericValue(subject.diem_he_4);
  return diem10 !== null && diem4 !== null;
}

// Alias của `hasResolvedGrade` để giữ tương thích.
function hasFinalGrade(subject) {
  // Giữ API cũ cho các chỗ gọi trước đây.
  return hasResolvedGrade(subject);
}

// Chỉ môn chưa có điểm chính thức mới có thể dự đoán.
function isPredictableSubject(subject) {
  // Điều kiện bật tính năng dự đoán theo môn.
  return !!subject && subject.da_co_diem !== true;
}

// Chuẩn hóa trọng số về % (hỗ trợ đầu vào 0-1 hoặc 0-100).
function normalizeWeightPercent(value, fallback = null) {
  // Không có dữ liệu thì trả fallback.
  const numericValue = parseNumericValue(value);
  if (numericValue === null) return fallback;
  if (numericValue >= 0 && numericValue <= 1) {
    // Dạng thập phân -> đổi sang phần trăm.
    return Math.round(numericValue * 100);
  }
  // Dạng phần trăm trực tiếp.
  return Math.round(numericValue);
}

// Tính điểm tổng kết môn từ QT/thi/trọng số + kết quả đạt/rớt.
function calculateSubjectFinal(diemQT, diemThi, trongSoQT, trongSoThi, isGDTC = false, gradeType = "type1") {
  // Điểm quá trình được làm tròn trước khi tính.
  const qtRounded = roundComponentScore(diemQT);
  // Thiếu điểm thi thì xem như 0.
  const finalExamScore = parseNumericValue(diemThi) ?? 0;
  const diem10 = (qtRounded * trongSoQT + finalExamScore * trongSoThi) / 100;
  const diem4 = convert10to4(diem10, gradeType);
  const diem_chu = convert10toLetter(diem10, gradeType);
  // GDTC/GDQP cần >=5; môn thường cần >=4.
  const passed = isGDTC ? diem10 >= 5.0 : diem10 >= 4.0;

  return { diem10, diem4, diem_chu, passed };
}

// Kiểm tra đủ điều kiện áp dụng dự đoán cho một môn.
function canApplyPrediction(subject) {
  // Chỉ áp dụng cho môn có thể dự đoán.
  if (!isPredictableSubject(subject)) return false;

  const diemQT = clampNumber(subject.diem_kiem_tra, 0, 10);
  const diemThi = clampNumber(subject.diem_thi, 0, 10);
  const trongSoQT = clampNumber(normalizeWeightPercent(subject.trong_so_1), 0, 100);
  const trongSoThi = clampNumber(normalizeWeightPercent(subject.trong_so_2), 0, 100);

  // Thiếu trường dữ liệu nào cũng không dự đoán được.
  if (diemQT === null || diemThi === null || trongSoQT === null || trongSoThi === null) {
    return false;
  }

  // Tổng trọng số phải đúng 100%.
  return Math.abs((trongSoQT + trongSoThi) - 100) < 1e-6;
}

// Tạo bản sao môn đã áp điểm dự đoán (preview/confirmed) nếu hợp lệ.
function buildPredictedSubject(subject, options = {}) {
  // Dùng thang điểm hiện hành của giao diện.
  const gradeType = options.gradeType || "type1";

  // Không có môn thì trả nguyên.
  if (!subject) return subject;

  // Môn có điểm chính thức: chỉ đồng bộ hệ 4/chữ.
  if (hasOfficialGrade(subject)) {
    return {
      ...subject,
      la_du_doan: false,
      du_doan_hop_le: true,
      diem_he_4: convert10to4(subject.diem_he_10, gradeType),
      diem_chu: convert10toLetter(subject.diem_he_10, gradeType),
      passed: subject.passed ?? ((parseNumericValue(subject.diem_he_10) ?? 0) >= (isExcludedSubject(subject) ? 5.0 : 4.0)),
    };
  }

  // Preview thì áp tạm; bình thường cần đã lưu dự đoán.
  const shouldPreview = options.preview === true;
  const canUsePrediction = canApplyPrediction(subject);
  const shouldApply = shouldPreview ? canUsePrediction : hasSavedPrediction(subject) && canUsePrediction;

  // Không áp được dự đoán thì reset các trường dự đoán.
  if (!shouldApply) {
    return {
      ...subject,
      la_du_doan: false,
      du_doan_hop_le: canUsePrediction,
      diem_he_10: null,
      diem_he_4: null,
      diem_chu: "--",
      passed: null,
    };
  }

  // Tính kết quả dự đoán từ 4 trường nhập liệu.
  const diemQT = clampNumber(subject.diem_kiem_tra, 0, 10);
  const diemThi = clampNumber(subject.diem_thi, 0, 10);
  const trongSoQT = clampNumber(normalizeWeightPercent(subject.trong_so_1), 0, 100);
  const trongSoThi = clampNumber(normalizeWeightPercent(subject.trong_so_2), 0, 100);
  const prediction = calculateSubjectFinal(
    diemQT,
    diemThi,
    trongSoQT,
    trongSoThi,
    isExcludedSubject(subject),
    gradeType
  );

  return {
    ...subject,
    la_du_doan: true,
    du_doan_hop_le: true,
    diem_he_10: prediction.diem10,
    diem_he_4: prediction.diem4,
    diem_chu: prediction.diem_chu,
    passed: prediction.passed,
  };
}

// Môn được tính GPA khi có điểm hợp lệ và không nằm trong nhóm loại trừ.
function isEligibleForGPA(subject) {
  // Điều kiện kép: có điểm + không bị loại.
  return hasResolvedGrade(subject) && !isExcludedSubject(subject);
}

// Kiểm tra môn đạt để cộng vào tổng tín chỉ tích lũy.
function isPassedSubject(subject) {
  // Không đủ điều kiện GPA thì không cộng tín chỉ đạt.
  if (!isEligibleForGPA(subject)) return false;
  const diem10 = parseNumericValue(subject.diem_he_10);
  const requiredScore = isExcludedSubject(subject) ? 5.0 : 4.0;
  return diem10 !== null && diem10 >= requiredScore;
}

// Parse chuỗi học kỳ thành cấu trúc số kỳ + năm học.
function parseSemesterKey(hocKy) {
  // Chuẩn hóa text trước khi regex.
  const normalized = normalizeText(hocKy);
  const match = normalized.match(/hoc ky\s+(\d+)\s*-\s*nam hoc\s*(\d{4})\s*-\s*(\d{4})/i);

  // Không khớp định dạng thì trả null.
  if (!match) return null;

  return {
    semesterNumber: Number(match[1]),
    startYear: Number(match[2]),
    endYear: Number(match[3]),
  };
}

// So sánh 2 học kỳ để sắp xếp đúng theo thứ tự thời gian.
function compareSemesterKeys(a, b) {
  // So sánh 2 học kỳ theo thứ tự thời gian.
  const parsedA = parseSemesterKey(a);
  const parsedB = parseSemesterKey(b);

  // So theo năm bắt đầu -> năm kết thúc -> số học kỳ.
  if (parsedA && parsedB) {
    if (parsedA.startYear !== parsedB.startYear) {
      return parsedA.startYear - parsedB.startYear;
    }
    if (parsedA.endYear !== parsedB.endYear) {
      return parsedA.endYear - parsedB.endYear;
    }
    if (parsedA.semesterNumber !== parsedB.semesterNumber) {
      return parsedA.semesterNumber - parsedB.semesterNumber;
    }
  // Parse được ưu tiên đứng trước parse không được.
  } else if (parsedA) {
    return -1;
  } else if (parsedB) {
    return 1;
  }

  // Fallback: so chuỗi theo locale tiếng Việt.
  return String(a ?? "").localeCompare(String(b ?? ""), "vi");
}

// Sắp xếp danh sách học kỳ tăng/giảm dần.
function sortSemesterKeys(keys, direction = "asc") {
  // Dùng một comparator chung cho toàn app.
  const factor = direction === "desc" ? -1 : 1;
  return [...keys].sort((a, b) => compareSemesterKeys(a, b) * factor);
}

// Xử lý học lại/cải thiện điểm: chọn lần điểm cao nhất cho GPA tích lũy.
function resolveRetakes(allSubjects) {
  // Xử lý học lại: chọn lần điểm cao nhất cho tích lũy.
  const byHocKy = {};

  // Nhóm môn theo học kỳ để render bảng theo kỳ.
  for (const subject of allSubjects || []) {
    const hocKy = subject?.hoc_ky || "Khong xac dinh";
    if (!byHocKy[hocKy]) byHocKy[hocKy] = [];
    byHocKy[hocKy].push(subject);
  }

  // Chỉ giữ môn đủ điều kiện tính GPA.
  const eligible = (allSubjects || []).filter(isEligibleForGPA);
  const bestMap = {};
  const countMap = {};

  // Mỗi mã môn chọn 1 lần có điểm cao nhất.
  for (const subject of eligible) {
    const key = String(subject?.ma_mon ?? "").trim();
    if (!key) continue;

    if (!countMap[key]) countMap[key] = [];
    countMap[key].push(subject);

    if (
      !bestMap[key] ||
      (parseNumericValue(subject.diem_he_10) ?? -1) > (parseNumericValue(bestMap[key].diem_he_10) ?? -1)
    ) {
      bestMap[key] = subject;
    }
  }

  // Đánh dấu các mã môn có nhiều lần học (học lại/cải thiện).
  const retakeMap = {};
  for (const [key, list] of Object.entries(countMap)) {
    if (list.length > 1) {
      const sorted = [...list].sort((a, b) => compareSemesterKeys(a.hoc_ky, b.hoc_ky));
      retakeMap[key] = {
        original: sorted[0],
        best: bestMap[key],
        allAttempts: sorted,
      };
    }
  }

  return {
    byHocKy,
    sortedHocKyAsc: sortSemesterKeys(Object.keys(byHocKy), "asc"),
    sortedHocKyDesc: sortSemesterKeys(Object.keys(byHocKy), "desc"),
    forCumulative: Object.values(bestMap),
    retakeMap,
  };
}

// Tính GPA học kỳ.
// Tính GPA theo từng học kỳ.
function calculateSemesterGPA(subjects) {
  // Tính GPA của một học kỳ và các chỉ số đi kèm.
  if (!subjects || subjects.length === 0) { // trả về không có dữ liệu khi mảng rỗng
    return { hoc_ky: "", gpa10: 0, gpa4: 0, tong_tin: 0, tong_tin_tinh_gpa: 0, co_du_lieu: false };
  }

  const eligible = subjects.filter(isEligibleForGPA);
  if (eligible.length === 0) {
    return {
      hoc_ky: subjects[0]?.hoc_ky || "",
      gpa10: 0,
      gpa4: 0,
      tong_tin: 0,
      tong_tin_tinh_gpa: 0,
      co_du_lieu: false,
    };
  }

  const gpaCredits = eligible.reduce((sum, subject) => sum + (parseNumericValue(subject.so_tin_chi) ?? 0), 0);
  if (gpaCredits === 0) {
    return {
      hoc_ky: eligible[0]?.hoc_ky || "",
      gpa10: 0,
      gpa4: 0,
      tong_tin: 0,
      tong_tin_tinh_gpa: 0,
      co_du_lieu: false,
    };
  }

  const ws10 = eligible.reduce((sum, subject) => {
    return sum + (parseNumericValue(subject.diem_he_10) ?? 0) * (parseNumericValue(subject.so_tin_chi) ?? 0);
  }, 0);

  const ws4 = eligible.reduce((sum, subject) => {
    return sum + (parseNumericValue(subject.diem_he_4) ?? 0) * (parseNumericValue(subject.so_tin_chi) ?? 0);
  }, 0);

  const earnedCredits = eligible
    .filter(isPassedSubject)
    .reduce((sum, subject) => sum + (parseNumericValue(subject.so_tin_chi) ?? 0), 0);

  return {
    hoc_ky: eligible[0]?.hoc_ky || "",
    gpa10: roundGPA(ws10 / gpaCredits),
    gpa4: roundGPA(ws4 / gpaCredits),
    tong_tin: earnedCredits,
    tong_tin_tinh_gpa: gpaCredits,
    co_du_lieu: true,
  };
}

// Tính GPA tích lũy hệ 4 (bản rút gọn).
function calculateCumulativeGPA(allSubjects) {
  // Tính GPA tích lũy hệ 4 (bản rút gọn).
  if (!allSubjects || allSubjects.length === 0) return 0;

  const { forCumulative } = resolveRetakes(allSubjects);
  if (forCumulative.length === 0) return 0;

  const gpaCredits = forCumulative.reduce((sum, subject) => sum + (parseNumericValue(subject.so_tin_chi) ?? 0), 0);
  if (gpaCredits === 0) return 0;

  const ws4 = forCumulative.reduce((sum, subject) => {
    return sum + (parseNumericValue(subject.diem_he_4) ?? 0) * (parseNumericValue(subject.so_tin_chi) ?? 0);
  }, 0);

  return roundGPA(ws4 / gpaCredits);
}

// Tính GPA tích lũy đầy đủ (hệ 10/hệ 4/tín chỉ/cờ dữ liệu).
function calculateCumulativeGPAFull(allSubjects) {
  // Tính GPA tích lũy đầy đủ (hệ 10/hệ 4/tín chỉ).
  if (!allSubjects || allSubjects.length === 0) {
    return { gpa10: 0, gpa4: 0, tong_tin: 0, tong_tin_tinh_gpa: 0, co_du_lieu: false };
  }

  const { forCumulative } = resolveRetakes(allSubjects);
  if (forCumulative.length === 0) {
    return { gpa10: 0, gpa4: 0, tong_tin: 0, tong_tin_tinh_gpa: 0, co_du_lieu: false };
  }

  const gpaCredits = forCumulative.reduce((sum, subject) => sum + (parseNumericValue(subject.so_tin_chi) ?? 0), 0);
  if (gpaCredits === 0) {
    return { gpa10: 0, gpa4: 0, tong_tin: 0, tong_tin_tinh_gpa: 0, co_du_lieu: false };
  }

  const ws10 = forCumulative.reduce((sum, subject) => {
    return sum + (parseNumericValue(subject.diem_he_10) ?? 0) * (parseNumericValue(subject.so_tin_chi) ?? 0);
  }, 0);

  const ws4 = forCumulative.reduce((sum, subject) => {
    return sum + (parseNumericValue(subject.diem_he_4) ?? 0) * (parseNumericValue(subject.so_tin_chi) ?? 0);
  }, 0);

  const earnedCredits = forCumulative
    .filter(isPassedSubject)
    .reduce((sum, subject) => sum + (parseNumericValue(subject.so_tin_chi) ?? 0), 0);

  return {
    gpa10: roundGPA(ws10 / gpaCredits),
    gpa4: roundGPA(ws4 / gpaCredits),
    tong_tin: earnedCredits,
    tong_tin_tinh_gpa: gpaCredits,
    co_du_lieu: true,
  };
}

// Xếp loại tốt nghiệp.
// Xếp loại tốt nghiệp theo GPA tích lũy.
function classifyGraduation(gpa4) {
  // Xếp loại tốt nghiệp theo GPA tích lũy.
  const score = parseNumericValue(gpa4) ?? 0;
  if (score < 2.0) return "Không đủ điều kiện tốt nghiệp";
  if (score < 2.5) return "Trung bình";
  if (score < 3.2) return "Khá";
  if (score < 3.6) return "Giỏi";
  return "Xuất sắc";
}

// Xếp loại học kỳ.
// Xếp loại học kỳ (không có mức "Không đủ điều kiện tốt nghiệp").
function classifySemesterAcademic(gpa4) {
  // Xếp loại học kỳ theo GPA hệ 4.
  const score = parseNumericValue(gpa4) ?? 0;
  if (score < 2.0) return "Yếu";
  if (score < 2.5) return "Trung bình";
  if (score < 3.2) return "Khá";
  if (score < 3.6) return "Giỏi";
  return "Xuất sắc";
}

// Xếp loại môn học.
// Gom điểm chữ về bucket A/B/C/D/F.
function toGradeBucket(letter) {
  // Gom điểm chữ về nhóm A/B/C/D/F.
  const normalized = String(letter || "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.startsWith("A")) return "A";
  if (normalized.startsWith("B")) return "B";
  if (normalized.startsWith("C")) return "C";
  if (normalized.startsWith("D")) return "D";
  if (normalized.startsWith("F")) return "F";
  return null;
}

// Tính tổng tín chỉ theo từng bucket điểm chữ.
function calculateGradeBucketCredits(subjects) {
  // Cộng tín chỉ theo từng nhóm điểm chữ.
  const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };

  (subjects || []).forEach((subject) => {
    if (!isEligibleForGPA(subject)) return;
    const bucket = toGradeBucket(subject.diem_chu || convert10toLetter(subject.diem_he_10));
    if (!bucket) return;
    buckets[bucket] += parseNumericValue(subject.so_tin_chi) ?? 0;
  });

  return buckets;
}

// Dự đoán điểm thi cần đạt để đạt mục tiêu điểm tổng.
function predictExamScore(diemQT, mucTieu10, trongSoQT, trongSoThi) {
  // Tính điểm thi tối thiểu để đạt mục tiêu điểm tổng.
  if (trongSoThi === 0) {
    return { diemThiCanDat: null, khaDi: false, thongBao: "Trong so thi khong the bang 0." };
  }

  const qtRounded = roundComponentScore(diemQT);
  const diemThiCanDat = (mucTieu10 * 100 - qtRounded * trongSoQT) / trongSoThi;

  if (diemThiCanDat < 0) {
    return { diemThiCanDat: 0, khaDi: true, thongBao: `Da du dat ${mucTieu10} du thi 0 diem.` };
  }

  if (diemThiCanDat > 10) {
    return {
      diemThiCanDat: null,
      khaDi: false,
      thongBao: `Khong the dat ${mucTieu10}; can thi ${diemThiCanDat.toFixed(1)} > 10.`,
    };
  }

  const canDat = Math.ceil(diemThiCanDat * 10) / 10;
  return {
    diemThiCanDat: canDat,
    khaDi: true,
    thongBao: `Can thi it nhat ${canDat} diem de dat muc tieu ${mucTieu10}.`,
  };
}

// Đánh giá mức cảnh báo học tập theo GPA tích lũy.
function checkAcademicWarning(gpa4Cumulative) {
  // Đánh giá mức cảnh báo học tập theo GPA tích lũy.
  const score = parseNumericValue(gpa4Cumulative) ?? 0;
  if (score < 1.0) return { mucDo: "BUOC_THOI_HOC", thongBao: "GPA < 1.0/4 - Nguy co buoc thoi hoc." };
  if (score < 1.2) return { mucDo: "CANH_BAO_CAO", thongBao: "GPA < 1.2/4 - Canh bao muc cao." };
  if (score < 1.6) return { mucDo: "CANH_BAO", thongBao: "GPA < 1.6/4 - Canh bao hoc tap." };
  return { mucDo: "BINH_THUONG", thongBao: "Ket qua hoc tap binh thuong." };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EXCLUDED_MA_MON,
    EXCLUDED_NAME_KEYWORDS,
    normalizeText,
    parseNumericValue,
    clampNumber,
    normalizeWeightPercent,
    roundComponentScore,
    roundGPA,
    convert10to4,
    convert10toLetter,
    convert4toLetter,
    GRADE_SCHEMES,
    getGradeScheme,
    resolveGradeBy10,
    hasOfficialGrade,
    hasSavedPrediction,
    hasPredictedGrade,
    hasResolvedGrade,
    hasFinalGrade,
    isPredictableSubject,
    isExcludedSubject,
    canApplyPrediction,
    buildPredictedSubject,
    isEligibleForGPA,
    isPassedSubject,
    parseSemesterKey,
    compareSemesterKeys,
    sortSemesterKeys,
    calculateSubjectFinal,
    resolveRetakes,
    calculateSemesterGPA,
    calculateCumulativeGPA,
    calculateCumulativeGPAFull,
    calculateGradeBucketCredits,
    classifyGraduation,
    classifySemesterAcademic,
    predictExamScore,
    checkAcademicWarning,
  };
}


