(function attachGradePdfParser(globalScope) {
    const PDFJS_MODULE_URL = "https://unpkg.com/pdfjs-dist/build/pdf.min.mjs";
    const PDFJS_WORKER_URL = "https://unpkg.com/pdfjs-dist/build/pdf.worker.min.mjs";

    const GROUP_MIN_X = 95;
    const GROUP_MAX_X = 130;
    const NAME_MIN_X = 90;
    const CREDIT_MIN_X = 320;
    const CREDIT_MAX_X = 350;
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
        if (!value || value.trim() === "") {
            return null;
        }

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

    function groupTokensIntoLines(tokens, yTolerance = 2.5) {
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

    function isSemesterHeaderLine(line) {
        const normalized = String(line?.normalizedText || "");
        return normalized.includes("hoc ky") && normalized.includes("nam hoc");
    }

    function isSubjectRowLine(line) {
        if (!Array.isArray(line.tokens) || line.tokens.length < 2) {
            return false;
        }

        const stt = line.tokens[0].text.trim();
        const maMon = line.tokens[1].text.trim();

        return (
            /^\d+$/.test(stt)
            && /^[A-Z0-9]{5,10}$/.test(maMon)
            && line.tokens[0].x0 < 40
            && line.tokens[1].x0 < 95
        );
    }

    function hasLetter(text) {
        return /[A-Za-z\u00C0-\u1EF9]/.test(String(text || ""));
    }

    function isNameOnlyLine(line) {
        if (!Array.isArray(line.tokens) || !line.tokens.length) {
            return false;
        }

        if (isSemesterHeaderLine(line) || isSubjectRowLine(line)) {
            return false;
        }

        const tokensInNameZone = line.tokens.filter((token) => token.x0 >= NAME_MIN_X && token.x0 < CREDIT_MIN_X);
        if (!tokensInNameZone.length) {
            return false;
        }

        const hasLetterInNameZone = tokensInNameZone.some((token) => hasLetter(token.text));
        if (!hasLetterInNameZone) {
            return false;
        }

        // If a line has letter tokens in score columns, it is likely not a subject name fragment.
        const hasLetterInScoreZone = line.tokens.some((token) => token.x0 >= CREDIT_MIN_X && hasLetter(token.text));
        return !hasLetterInScoreZone;
    }

    function firstTextInRange(tokens, left, right) {
        const token = tokens.find((item) => item.x0 >= left && item.x0 < right);
        return token ? token.text : null;
    }

    function findCreditTextInRow(tokens) {
        const direct = firstTextInRange(tokens, CREDIT_MIN_X, CREDIT_MAX_X);
        if (direct) return direct;

        const fallbackToken = [...tokens]
            .filter((token) => token.x0 >= 260 && token.x0 < 380)
            .filter((token) => /^\d{1,2}$/.test(token.text?.trim()))
            .filter((token) => {
                const value = Number.parseInt(token.text.trim(), 10);
                return Number.isFinite(value) && value >= 1 && value <= 12;
            })
            .sort((a, b) => b.x0 - a.x0)[0];

        return fallbackToken ? fallbackToken.text.trim() : null;
    }

    function collectSameLineName(tokens) {
        const nameTokens = tokens
            .filter((token) => token.x0 >= NAME_MIN_X && token.x0 < CREDIT_MIN_X)
            .filter((token) => {
                const text = String(token.text || "").trim();
                if (!text) return false;
                if (/^\d+([.,]\d+)?$/.test(text)) return false;
                if (/^[A-Z0-9]{5,10}$/.test(text)) return false;
                return true;
            })
            .map((token) => token.text)
            .filter(Boolean);

        if (!nameTokens.length) {
            return "";
        }

        if (/^\d{1,2}$/.test(nameTokens[0])) {
            nameTokens.shift();
        }

        return nameTokens.join(" ").trim();
    }

    function collectSubjectNameFromRows(lines, rowEntries, rowPosition) {
        const rowEntry = rowEntries[rowPosition];
        const rowLine = rowEntry?.line;
        if (!rowLine) return "";

        const prevRowIndex = rowEntries[rowPosition - 1]?.index ?? -1;
        const nextRowIndex = rowEntries[rowPosition + 1]?.index ?? lines.length;
        const nameParts = [];

        const sameLineName = collectSameLineName(rowLine.tokens);
        if (sameLineName) {
            nameParts.push({ y: rowLine.y, text: sameLineName });
        }

        // Scan wrapped name lines immediately above row (if renderer pushed first chunk upward).
        let upLastY = rowLine.y;
        for (let idx = rowEntry.index - 1; idx > prevRowIndex; idx -= 1) {
            const line = lines[idx];
            if (!line) break;

            const verticalGap = Math.abs(line.y - upLastY);
            if (verticalGap > 14) {
                break;
            }

            if (isNameOnlyLine(line)) {
                nameParts.push({ y: line.y, text: line.text });
                upLastY = line.y;
            } else {
                break;
            }
        }

        // Name lines wrapped below this row.
        let lastAcceptedY = rowLine.y;
        for (let idx = rowEntry.index + 1; idx < nextRowIndex; idx += 1) {
            const line = lines[idx];
            if (!line) break;

            const verticalGap = Math.abs(lastAcceptedY - line.y);
            if (verticalGap > 14) {
                break;
            }

            if (isNameOnlyLine(line)) {
                nameParts.push({ y: line.y, text: line.text });
                lastAcceptedY = line.y;
            } else {
                break;
            }
        }

        return nameParts
            .sort((a, b) => b.y - a.y)
            .map((part) => part.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .replace(/^\d{1,2}\s+/, "")
            .trim();
    }

    function buildSubjectRecord({ maMon, tenMon, nhom, soTin, hocKy, diemHe10, diemHe4 }) {
        const hasOfficialGrade = diemHe10 !== null || diemHe4 !== null;

        return {
            ma_mon: maMon,
            ten_mon: tenMon,
            nhom: nhom || null,
            so_tin_chi: soTin,
            hoc_ky: hocKy,
            da_co_diem: hasOfficialGrade,
            diem_he_10: hasOfficialGrade ? diemHe10 : null,
            diem_he_4: hasOfficialGrade ? diemHe4 : null,
            diem_kiem_tra: null,
            diem_thi: null,
            trong_so_1: hasOfficialGrade ? null : 40,
            trong_so_2: hasOfficialGrade ? null : 60,
        };
    }

    function parseRowsInPage(lines, inheritedSemester = "Chưa xác định") {
        let currentSemester = inheritedSemester;
        const subjects = [];

        const semesterHeaders = lines
            .map((line, index) => ({ line, index }))
            .filter((entry) => isSemesterHeaderLine(entry.line))
            .map((entry) => ({
                index: entry.index,
                label: entry.line.text.replace(/\s+/g, " ").trim(),
            }));

        const rowEntries = lines
            .map((line, index) => ({ line, index }))
            .filter((entry) => isSubjectRowLine(entry.line));

        rowEntries.forEach((entry, rowPosition) => {
            const line = entry.line;
            const maMon = firstTextInRange(line.tokens, 40, 95);
            const nhom = firstTextInRange(line.tokens, GROUP_MIN_X, GROUP_MAX_X);
            const soTinText = findCreditTextInRow(line.tokens);
            const tenMon = collectSubjectNameFromRows(lines, rowEntries, rowPosition);

            if (!maMon || !soTinText || !tenMon) {
                return;
            }

            const soTin = Number.parseInt(soTinText, 10);
            if (!Number.isFinite(soTin)) {
                return;
            }

            const diemHe10 = parseFloatValue(firstTextInRange(line.tokens, SCORE10_MIN_X, SCORE10_MAX_X));
            const diemHe4 = parseFloatValue(firstTextInRange(line.tokens, SCORE4_MIN_X, SCORE4_MAX_X));

            const nearestHeader = semesterHeaders
                .filter((header) => header.index < entry.index)
                .sort((a, b) => b.index - a.index)[0];

            if (nearestHeader) {
                currentSemester = nearestHeader.label;
            }

            subjects.push(buildSubjectRecord({
                maMon,
                tenMon,
                nhom,
                soTin,
                hocKy: currentSemester,
                diemHe10,
                diemHe4,
            }));
        });

        return {
            subjects,
            currentSemester,
        };
    }

    async function parseGradePdfFile(file) {
        if (!(file instanceof File)) {
            throw new Error("File PDF không hợp lệ.");
        }

        const pdfjsLib = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDocument = await loadingTask.promise;

        const subjects = [];
        let currentSemester = "Chưa xác định";

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const tokens = collectTokens(textContent.items);
            const lines = groupTokensIntoLines(tokens);
            const parsedPage = parseRowsInPage(lines, currentSemester);
            currentSemester = parsedPage.currentSemester;
            subjects.push(...parsedPage.subjects);
        }

        if (!subjects.length) {
            throw new Error("Không đọc được môn học từ file PDF này.");
        }

        return subjects;
    }

    globalScope.gradePdfParser = {
        parseGradePdfFile,
    };

    // Optional debug hooks for local tests.
    globalScope.gradePdfParserDebug = {
        parseRowsInPage,
        groupTokensIntoLines,
        collectTokens,
    };
})(window);
