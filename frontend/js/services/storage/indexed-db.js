(function attachGradeStorage(globalScope) {
    const DB_NAME = "sgu-grade-predictor";
    const DB_VERSION = 2;
    const STORE_NAME = "app_state";
    const DASHBOARD_KEY = "dashboard";

    let dbPromise = null;

    function supportsIndexedDb() {
        return typeof globalScope.indexedDB !== "undefined";
    }

    function openDatabase() {
        if (!supportsIndexedDb()) {
            return Promise.resolve(null);
        }

        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const request = globalScope.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = () => {
                    const database = request.result;

                    if (!database.objectStoreNames.contains(STORE_NAME)) {
                        database.createObjectStore(STORE_NAME, { keyPath: "id" });
                    }
                };

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error("Khong the mo IndexedDB."));
            });
        }

        return dbPromise;
    }

    async function readDashboardRecord() {
        const database = await openDatabase();
        if (!database) return null;

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(DASHBOARD_KEY);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error("Khong the doc IndexedDB."));
        });
    }

    async function writeDashboardRecord(payload) {
        const database = await openDatabase();
        if (!database) return false;

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({
                id: DASHBOARD_KEY,
                payload,
                updatedAt: Date.now(),
            });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error("Khong the luu IndexedDB."));
        });
    }

    async function clearDashboardRecord() {
        const database = await openDatabase();
        if (!database) return false;

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(DASHBOARD_KEY);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error || new Error("Khong the xoa IndexedDB."));
        });
    }

    function readLegacyLocalStorage(legacyKeys = []) {
        for (const key of legacyKeys) {
            try {
                const rawValue = globalScope.localStorage.getItem(key);
                if (!rawValue) continue;

                const payload = JSON.parse(rawValue);
                const subjects = Array.isArray(payload?.sourceSubjects)
                    ? payload.sourceSubjects
                    : Array.isArray(payload?.subjects)
                        ? payload.subjects
                        : Array.isArray(payload?.viewSubjects)
                            ? payload.viewSubjects
                            : null;

                if (!subjects) continue;

                return {
                    currentFileName: payload?.currentFileName || "",
                    semesterStates: payload?.semesterStates || {},
                    sourceSubjects: subjects,
                    gradeType: payload?.gradeType || "type1",
                    dataOrigin: payload?.dataOrigin || "local",
                };
            } catch (error) {
                console.warn("Khong the doc du lieu legacy trong localStorage", error);
            }
        }

        return null;
    }

    function clearLegacyLocalStorage(legacyKeys = []) {
        legacyKeys.forEach((key) => {
            try {
                globalScope.localStorage.removeItem(key);
            } catch (error) {
                console.warn("Khong the xoa localStorage cu", error);
            }
        });
    }

    function writeLegacyLocalStorage(payload, legacyKeys = []) {
        const targetKeys = legacyKeys.length ? legacyKeys : ["sgu-grade-predictor:dashboard"];
        const serialized = JSON.stringify(payload);

        targetKeys.forEach((key) => {
            try {
                globalScope.localStorage.setItem(key, serialized);
            } catch (error) {
                console.warn("Khong the luu fallback localStorage", error);
            }
        });
    }

    async function loadDashboardState(options = {}) {
        const legacyKeys = Array.isArray(options.legacyKeys) ? options.legacyKeys : [];

        try {
            const existingRecord = await readDashboardRecord();
            if (existingRecord?.payload) {
                return existingRecord.payload;
            }
        } catch (error) {
            console.warn("Khong the doc dashboard state tu IndexedDB", error);
        }

        const legacyPayload = readLegacyLocalStorage(legacyKeys);
        if (!legacyPayload) {
            return null;
        }

        try {
            await writeDashboardRecord(legacyPayload);
            clearLegacyLocalStorage(legacyKeys);
        } catch (error) {
            console.warn("Khong the migrate localStorage sang IndexedDB", error);
        }

        return legacyPayload;
    }

    async function saveDashboardState(payload, options = {}) {
        const legacyKeys = Array.isArray(options.legacyKeys) ? options.legacyKeys : [];

        if (!payload || typeof payload !== "object") {
            return false;
        }

        if (!supportsIndexedDb()) {
            writeLegacyLocalStorage(payload, legacyKeys);
            return true;
        }

        try {
            const saved = await writeDashboardRecord(payload);
            if (saved) {
                clearLegacyLocalStorage(legacyKeys);
            }
            return saved;
        } catch (error) {
            console.warn("Khong the luu dashboard state vao IndexedDB", error);
            writeLegacyLocalStorage(payload, legacyKeys);
            return false;
        }
    }

    globalScope.gradeStorage = {
        loadDashboardState,
        saveDashboardState,
        clearDashboardRecord,
    };
})(window);
