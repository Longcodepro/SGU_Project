(function attachGradePdfParser(globalScope) {
    const PDFJS_MODULE_URL = "https://unpkg.com/pdfjs-dist/build/pdf.min.mjs";
    const PDFJS_WORKER_URL = "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.mjs";

    // Cấu hình tọa độ X dựa trên cấu trúc bảng điểm SGU
    const GROUP_MIN_X = 90;
    const GROUP_MAX_X = 135;
    const NAME_MIN_X = 135;
    const CREDIT_MIN_X = 320;
    const CREDIT_MAX_X = 360;
    const SCORE10_MIN_X = 360;
    const SCORE10_MAX_X = 405;
    const SCORE4_MIN_X = 410;
    const SCORE4_MAX_X = 455;

    let pdfJsPromise = null;

    function normalizeText(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\u0111/g, "d")
            .replace(/\u0110/g, "D")
            .toLowerCase()
            .trim();
    }

    function parseFloatValue(value) {
        if (!value || value.trim() === "") return null;
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }

    async function getPdfJs() {
        if (!pdfJsPromise) {
            pdfJsPromise = import(PDFJS_MODULE_URL).then((pdfjsLib) => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
                return pdfjsLib;
            });
        }
        return pdfJsPromise;
    }

    function collectTokens(items = []) {
        return items
            .map((item) => ({
                text: String(item?.str ?? "").trim(),
                x0: Number(item?.transform?.[4] ?? 0),
                y: Number(item?.transform?.[5] ?? 0),
            }))
            .filter((item) => item.text !== "");
    }

    function groupTokensIntoLines(tokens, yTolerance = 3.5) {
        const lines = [];
        tokens.forEach((token) => {
            let line = lines.find((candidate) => Math.abs(candidate.y - token.y) <= yTolerance);
            if (!line) {
                line = { y: token.y, tokens: [] };
                lines.push(line);
            }
            line.tokens.push(token);
        });

        lines.forEach((line) => {
            line.tokens.sort((a, b) => a.x0 - b.x0);
            line.text = line.tokens.map((token) => token.text).join(" ").trim();
            line.normalizedText = normalizeText(line.text);
        });

        return lines.sort((a, b) => b.y - a.y);
    }

    function extractSemesterLabel(line) {
        const text = String(line?.text || "").replace(/\s+/g, " ").trim();
        const normalized = normalizeText(text);
        const compact = normalized.replace(/\s+/g, "");
        const match = compact.match(/hock[yi](\d+)-?namhoc(\d{4})[-–—](\d{4})/);

        if (!match) return null;

        return `Học kỳ ${match[1]} - Năm học ${match[2]} - ${match[3]}`;
    }

    function isSemesterHeaderLine(line) {
        return extractSemesterLabel(line) !== null;
    }

    // Hàm mới: Nhận diện các dòng thống kê cuối kỳ để block lại
    function isSummaryLine(line) {
        const text = String(line?.normalizedText || "");
        return line.text.trim().startsWith("-") ||
               text.includes("diem trung binh") ||
               text.includes("so tin chi") ||
               text.includes("phan loai") ||
               text.includes("ket qua");
    }

    function isSubjectRowLine(line) {
        if (!Array.isArray(line.tokens) || line.tokens.length < 2) return false;
        const stt = line.tokens[0].text.trim();
        const maMon = line.tokens[1].text.trim();
        return /^\d+$/.test(stt) && /^[A-Z0-9]{5,10}$/.test(maMon) && line.tokens[0].x0 < 50;
    }

    function isNameOnlyLine(line) {
        if (!Array.isArray(line.tokens) || !line.tokens.length) return false;
        
        // Bỏ qua nếu là header, dòng môn học, hoặc dòng thống kê
        if (isSemesterHeaderLine(line) || isSubjectRowLine(line) || isSummaryLine(line)) return false;
        
        const tokensInNameZone = line.tokens.filter((token) => token.x0 >= 130 && token.x0 < CREDIT_MIN_X);
        return tokensInNameZone.length > 0;
    }

    function firstTextInRange(tokens, left, right) {
        const token = tokens.find((item) => item.x0 >= left && item.x0 < right);
        return token ? token.text : null;
    }

    function collectSubjectNameFromRows(lines, rowEntries, rowPosition) {
        const rowEntry = rowEntries[rowPosition];
        const rowLine = rowEntry?.line;
        if (!rowLine) return "";

        const prevRowIndex = rowEntries[rowPosition - 1]?.index ?? -1;
        const nextRowIndex = rowEntries[rowPosition + 1]?.index ?? lines.length;
        const nameParts = [];

        // Lấy phần tên trên cùng dòng với STT/Mã môn
        const sameLineName = rowLine.tokens
            .filter((t) => t.x0 >= 130 && t.x0 < CREDIT_MIN_X)
            .map((t) => t.text).join(" ");
        
        if (sameLineName) nameParts.push({ y: rowLine.y, text: sameLineName });

        // Một số file PDF render phần đầu tên môn nằm phía trên dòng STT/Mã môn.
        let previousY = rowLine.y;
        for (let idx = rowEntry.index - 1; idx > prevRowIndex; idx--) {
            const line = lines[idx];
            if (!line || isSemesterHeaderLine(line) || isSummaryLine(line)) break;

            const verticalGap = Math.abs(line.y - previousY);
            if (verticalGap > 16) break;

            if (!isNameOnlyLine(line)) break;
            nameParts.push({ y: line.y, text: line.text });
            previousY = line.y;
        }

        // Quét các dòng phụ (wrap text) nằm giữa dòng hiện tại và dòng kế tiếp
        let nextY = rowLine.y;
        for (let idx = rowEntry.index + 1; idx < nextRowIndex; idx++) {
            const line = lines[idx];
            
            // DỪNG NGAY nếu đụng header học kỳ mới hoặc các dòng thống kê điểm
            if (isSemesterHeaderLine(line) || isSummaryLine(line)) {
                break; 
            }

            const verticalGap = Math.abs(nextY - line.y);
            if (verticalGap > 16) break;

            if (isNameOnlyLine(line)) {
                nameParts.push({ y: line.y, text: line.text });
                nextY = line.y;
            } else {
                break;
            }
        }

        return nameParts
            .sort((a, b) => b.y - a.y)
            .map(p => p.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function parseRowsInPage(lines, inheritedSemester = "Chưa xác định") {
        let currentSemester = inheritedSemester;
        const subjects = [];

        const rowEntries = lines
            .map((line, index) => ({ line, index }))
            .filter((entry) => isSubjectRowLine(entry.line));

        let rowPosition = 0;

        lines.forEach((currentLine, rowIndex) => {
            const semesterLabel = extractSemesterLabel(currentLine);
            if (semesterLabel) {
                currentSemester = semesterLabel;
                return;
            }

            if (!isSubjectRowLine(currentLine)) return;

            const currentRowPosition = rowPosition;
            const entry = rowEntries[currentRowPosition];
            rowPosition += 1;
            if (!entry || entry.index !== rowIndex) return;

            const line = entry.line;

            const maMon = line.tokens[1].text;
            const nhom = firstTextInRange(line.tokens, GROUP_MIN_X, GROUP_MAX_X);
            const soTin = parseInt(firstTextInRange(line.tokens, CREDIT_MIN_X, CREDIT_MAX_X), 10);
            const tenMon = collectSubjectNameFromRows(lines, rowEntries, currentRowPosition);

            if (!maMon || isNaN(soTin)) return;

            const diemHe10 = parseFloatValue(firstTextInRange(line.tokens, SCORE10_MIN_X, SCORE10_MAX_X));
            const diemHe4 = parseFloatValue(firstTextInRange(line.tokens, SCORE4_MIN_X, SCORE4_MAX_X));

            subjects.push({
                ma_mon: maMon,
                ten_mon: tenMon,
                nhom: nhom || null,
                so_tin_chi: soTin,
                hoc_ky: currentSemester,
                da_co_diem: diemHe10 !== null,
                diem_he_10: diemHe10,
                diem_he_4: diemHe4,
                diem_kiem_tra: null,
                diem_thi: null,
                trong_so_1: 40,
                trong_so_2: 60
            });
        });

        return { subjects, currentSemester };
    }

    async function parseGradePdfFile(file) {
        if (!(file instanceof File)) throw new Error("File PDF không hợp lệ.");
        const pdfjsLib = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDocument = await loadingTask.promise;

        const subjects = [];
        let currentSemester = "Chưa xác định";

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
            const page = await pdfDocument.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const tokens = collectTokens(textContent.items);
            const lines = groupTokensIntoLines(tokens);
            const parsedPage = parseRowsInPage(lines, currentSemester);
            currentSemester = parsedPage.currentSemester;
            subjects.push(...parsedPage.subjects);
        }

        if (!subjects.length) throw new Error("Không đọc được dữ liệu môn học.");
        return subjects;
    }

    globalScope.gradePdfParser = { parseGradePdfFile };
    globalScope.gradePdfParserDebug = {
        collectTokens,
        extractSemesterLabel,
        groupTokensIntoLines,
        parseRowsInPage,
    };
})(window);
