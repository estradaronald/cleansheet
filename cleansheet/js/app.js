/* ========================================
   CLEANSHEET
   Main Application Controller
======================================== */

(() => {
    "use strict";

    const app = {
        initialized: false,
        pythonReady: false,
        pythonVersion: null,
        currentDataset: null,
        currentFile: null,
        currentPage: "overview",
        missingOperationSelected: false,
        previewAvailable: false,
        pendingOperations: []
    };

    const elements = {
        statusIndicator: document.querySelector(".status-indicator"),
        breadcrumbPage: document.getElementById("breadcrumbPage"),

        totalRows: document.getElementById("totalRows"),
        totalColumns: document.getElementById("totalColumns"),
        missingValues: document.getElementById("missingValues"),
        duplicateRows: document.getElementById("duplicateRows"),

        tableContainer: document.getElementById("tableContainer"),
        previewCount: document.getElementById("previewCount"),

        cleaningFilename: document.getElementById("cleaningFilename"),
        cleaningDatasetDetails: document.getElementById("cleaningDatasetDetails"),
        cleaningDatasetStatus: document.getElementById("cleaningDatasetStatus"),

        missingColumnPicker: document.getElementById("missingColumnPicker"),
        missingStrategy: document.getElementById("missingStrategy"),
        customMissingValue: document.getElementById("customMissingValue"),
        customValueControl: document.getElementById("customValueControl"),
        applyMissingCleaning: document.getElementById("applyMissingCleaning"),

        textColumnPicker: document.getElementById("textColumnPicker"),
        textCase: document.getElementById("textCase"),
        trimWhitespace: document.getElementById("trimWhitespace"),
        removeDuplicates: document.getElementById("removeDuplicates"),

        cleaningMissingCount: document.getElementById("cleaningMissingCount"),
        cleaningDuplicateCount: document.getElementById("cleaningDuplicateCount"),

        previewCleaning: document.getElementById("previewCleaning"),
        resetCleaning: document.getElementById("resetCleaning"),
        cleaningPreviewContainer: document.getElementById("cleaningPreviewContainer"),
        cleaningPreviewCount: document.getElementById("cleaningPreviewCount"),

        exportFormat: document.getElementById("exportFormat"),
        downloadCleanedDataset: document.getElementById("downloadCleanedDataset")
    };

    /* ========================================
       GENERAL HELPERS
    ======================================== */

    function refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function setButtonContent(button, html) {
        if (!button) return;
        button.innerHTML = html;
        refreshIcons();
    }

    function updateRuntimeStatus(status, message) {
        const indicator = elements.statusIndicator;
        if (!indicator) return;

        const dot = indicator.querySelector(".status-dot");

        if (dot) {
            dot.style.background =
                status === "ready" ? "#16865C" :
                status === "error" ? "#D64545" : "#B7791F";
        }

        indicator.setAttribute("title", message);

        let statusText = indicator.querySelector(".status-text");

        if (!statusText) {
            statusText = document.createElement("span");
            statusText.className = "status-text";
            indicator.append(document.createTextNode(" "), statusText);
        }

        statusText.textContent = message;
    }

    function showError(prefix, error) {
        console.error(prefix, error);
        alert(`${prefix}: ${error?.message || error}`);
    }

    /* ========================================
       PAGE NAVIGATION
    ======================================== */

    const pageNames = {
        overview: "Overview",
        cleaning: "Data cleaning"
    };

    function showPage(pageName) {
        if (!pageNames[pageName]) {
            pageName = "overview";
        }

        app.currentPage = pageName;

        document.querySelectorAll("[data-view]").forEach(page => {
            const active = page.dataset.view === pageName;
            page.hidden = !active;
            page.style.display = active ? "block" : "none";
        });

        document.querySelectorAll(".nav-link[data-page]").forEach(link => {
            const active = link.dataset.page === pageName;

            link.classList.toggle("active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        if (elements.breadcrumbPage) {
            elements.breadcrumbPage.textContent = pageNames[pageName];
        }

        document.title = `${pageNames[pageName]} | CleanSheet`;
    }

    function initializeNavigation() {
        document.querySelectorAll(".nav-link[data-page]").forEach(link => {
            link.addEventListener("click", event => {
                event.preventDefault();

                const pageName = link.dataset.page;
                showPage(pageName);

                if (window.location.hash !== `#${pageName}`) {
                    window.location.hash = pageName;
                }
            });
        });

        window.addEventListener("hashchange", () => {
            showPage(window.location.hash.substring(1) || "overview");
        });

        showPage(window.location.hash.substring(1) || "overview");
    }

    /* ========================================
       PYTHON BRIDGE
    ======================================== */

    async function runPythonJSON(code) {
        const result = await window.CleanSheetPython.runPython(code);

        try {
            let value = result;

            if (result && typeof result.toJs === "function") {
                value = result.toJs({
                    dict_converter: Object.fromEntries
                });
            }

            if (typeof value === "string") {
                return JSON.parse(value);
            }

            return value;
        } finally {
            if (result && typeof result.destroy === "function") {
                result.destroy();
            }
        }
    }

    async function testPython() {
        const result = await window.CleanSheetPython.runPython(`
import sys
import pandas as pd
import openpyxl

{
    "python_version": sys.version.split()[0],
    "pandas_version": pd.__version__,
    "openpyxl_version": openpyxl.__version__
}
        `);

        try {
            return result.toJs({
                dict_converter: Object.fromEntries
            });
        } finally {
            result.destroy();
        }
    }

    /* ========================================
       DATA TABLES
    ======================================== */

    function createTable(preview) {
        const columns = preview?.columns || [];
        const rows = preview?.rows || [];

        const wrapper = document.createElement("div");
        wrapper.className = "table-scroll";

        if (!columns.length) {
            wrapper.textContent = "No data available.";
            return wrapper;
        }

        const table = document.createElement("table");
        table.className = "data-table";

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        columns.forEach(column => {
            const th = document.createElement("th");
            th.textContent = column;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        rows.forEach(row => {
            const tr = document.createElement("tr");

            row.forEach(value => {
                const td = document.createElement("td");
                const missing = value === null || value === undefined;

                td.textContent = missing ? "—" : String(value);

                if (missing) {
                    td.classList.add("missing-cell");
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        wrapper.appendChild(table);

        return wrapper;
    }

    function renderPreview(preview) {
        if (!elements.tableContainer || !preview) return;

        elements.tableContainer.replaceChildren(createTable(preview));

        if (elements.previewCount) {
            elements.previewCount.textContent =
                `${preview.preview_count} of ${preview.total_rows} rows`;
        }

        refreshIcons();
    }

    /* ========================================
       MULTI-COLUMN PICKERS
    ======================================== */

    function getPickerCheckboxes(picker) {
        if (!picker) return [];

        return [
            ...picker.querySelectorAll(
                ".column-picker-options input[type='checkbox']"
            )
        ];
    }

    function getSelectedColumns(picker) {
        return getPickerCheckboxes(picker)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);
    }

    function updatePickerLabel(picker) {
        if (!picker) return;

        const label = picker.querySelector(".column-picker-label");
        const selectAll = picker.querySelector(".column-select-all");

        const checkboxes = getPickerCheckboxes(picker);
        const selected = checkboxes.filter(checkbox => checkbox.checked);

        if (selectAll) {
            selectAll.checked =
                checkboxes.length > 0 &&
                selected.length === checkboxes.length;

            selectAll.indeterminate =
                selected.length > 0 &&
                selected.length < checkboxes.length;
        }

        if (!label) return;

        if (selected.length === 0) {
            label.textContent = "Choose columns";
        } else if (selected.length === checkboxes.length) {
            label.textContent = "All columns";
        } else if (selected.length === 1) {
            label.textContent = selected[0];
        } else {
            label.textContent = `${selected.length} columns selected`;
        }
    }

    function closeColumnPickers(exceptPicker = null) {
        document.querySelectorAll(".column-picker").forEach(picker => {
            if (picker === exceptPicker) return;

            const dropdown = picker.querySelector(".column-picker-dropdown");
            const trigger = picker.querySelector(".column-picker-trigger");

            if (dropdown) {
                dropdown.hidden = true;
                dropdown.style.display = "none";
            }

            trigger?.setAttribute("aria-expanded", "false");
        });
    }

    function initializeColumnPickers() {
        document.querySelectorAll(".column-picker").forEach(picker => {
            const trigger = picker.querySelector(".column-picker-trigger");
            const dropdown = picker.querySelector(".column-picker-dropdown");
            const search = picker.querySelector(".column-picker-search");
            const options = picker.querySelector(".column-picker-options");
            const selectAll = picker.querySelector(".column-select-all");

            if (!trigger || !dropdown) return;

            dropdown.hidden = true;
            dropdown.style.display = "none";

            trigger.addEventListener("click", event => {
                event.preventDefault();
                event.stopPropagation();

                const opening = dropdown.hidden;

                closeColumnPickers(picker);

                if (opening) {
                    dropdown.hidden = false;
                    dropdown.style.display = "block";

                    trigger.setAttribute("aria-expanded", "true");
                    search?.focus();
                } else {
                    dropdown.hidden = true;
                    dropdown.style.display = "none";

                    trigger.setAttribute("aria-expanded", "false");
                }
            });

            options?.addEventListener("change", event => {
                if (event.target.matches('input[type="checkbox"]')) {
                    updatePickerLabel(picker);
                }
            });

            selectAll?.addEventListener("change", () => {
                getPickerCheckboxes(picker).forEach(checkbox => {
                    checkbox.checked = selectAll.checked;
                });

                updatePickerLabel(picker);
            });

            search?.addEventListener("input", () => {
                const query = search.value.trim().toLowerCase();

                picker.querySelectorAll(".column-picker-option").forEach(option => {
                    option.style.display =
                        option.textContent.toLowerCase().includes(query)
                            ? "flex"
                            : "none";
                });
            });
        });

        document.addEventListener("click", event => {
            if (!event.target.closest(".column-picker")) {
                closeColumnPickers();
            }
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeColumnPickers();
            }
        });
    }

    function populateColumnSelects(columns) {
        const pickers = [
            elements.missingColumnPicker,
            elements.textColumnPicker
        ];

        pickers.forEach(picker => {
            if (!picker) return;

            const optionsContainer =
                picker.querySelector(".column-picker-options");

            const search = picker.querySelector(".column-picker-search");

            if (!optionsContainer) return;

            optionsContainer.replaceChildren();

            columns.forEach(column => {
                const option = document.createElement("label");
                option.className = "column-picker-option";

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = String(column);

                if (picker.id === "missingColumnPicker") {
                    checkbox.checked = true;
                }

                const text = document.createElement("span");
                text.textContent = String(column);

                option.append(checkbox, text);
                optionsContainer.appendChild(option);
            });

            if (search) {
                search.value = "";
            }

            updatePickerLabel(picker);
        });

        closeColumnPickers();
    }

    /* ========================================
       DATASET INFORMATION
    ======================================== */

    function updateStatistics(statistics) {
        if (!statistics) return;

        if (elements.totalRows) {
            elements.totalRows.textContent =
                (statistics.total_rows ?? 0).toLocaleString();
        }

        if (elements.totalColumns) {
            elements.totalColumns.textContent =
                (statistics.total_columns ?? 0).toLocaleString();
        }

        if (elements.missingValues) {
            elements.missingValues.textContent =
                (statistics.missing_values ?? 0).toLocaleString();
        }

        if (elements.duplicateRows) {
            elements.duplicateRows.textContent =
                (statistics.duplicate_rows ?? 0).toLocaleString();
        }
    }

    function updateCleaningDataset(dataset, fileInfo) {
        if (!dataset || !fileInfo) return;

        const statistics = dataset.statistics || {};
        const preview = dataset.preview || {};

        if (elements.cleaningFilename) {
            elements.cleaningFilename.textContent = fileInfo.name;
        }

        if (elements.cleaningDatasetDetails) {
            const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2);

            elements.cleaningDatasetDetails.textContent =
                `${statistics.total_rows} rows · ${statistics.total_columns} columns · ${sizeMB} MB`;
        }

        if (elements.cleaningDatasetStatus) {
            elements.cleaningDatasetStatus.textContent = "Dataset loaded";
        }

        if (elements.cleaningMissingCount) {
            elements.cleaningMissingCount.textContent =
                `${statistics.missing_values ?? 0} missing`;
        }

        if (elements.cleaningDuplicateCount) {
            elements.cleaningDuplicateCount.textContent =
                `${statistics.duplicate_rows ?? 0} duplicates`;
        }

        populateColumnSelects(preview.columns || []);
    }

    function resetControlsForNewDataset() {
        app.missingOperationSelected = false;
        app.previewAvailable = false;
        app.pendingOperations = [];

        if (elements.removeDuplicates) {
            elements.removeDuplicates.checked = false;
        }

        if (elements.trimWhitespace) {
            elements.trimWhitespace.checked = false;
        }

        if (elements.textCase) {
            elements.textCase.value = "none";
        }

        if (elements.applyMissingCleaning) {
            setButtonContent(
                elements.applyMissingCleaning,
                '<i data-lucide="check"></i> Apply operation'
            );
        }
    }

    function handleDatasetUploaded(event) {
        const { fileInfo, dataset } = event.detail || {};

        if (!dataset || !dataset.success) {
            console.error("Invalid dataset response:", dataset);
            return;
        }

        app.currentDataset = dataset;
        app.currentFile = fileInfo;

        resetControlsForNewDataset();

        updateStatistics(dataset.statistics);
        renderPreview(dataset.preview);
        updateCleaningDataset(dataset, fileInfo);

        clearCleaningPreview();

        console.log("Dataset loaded successfully:", dataset);
    }

    window.addEventListener(
        "cleansheet:file-uploaded",
        handleDatasetUploaded
    );

    window.addEventListener("cleansheet:upload-error", event => {
        console.error("Dataset upload error:", event.detail?.message);
    });

    /* ========================================
       COLLECT CLEANING OPERATIONS
    ======================================== */

    function collectCleaningOperations() {
        const operations = [];

        if (app.missingOperationSelected && elements.missingStrategy) {
            const columns = getSelectedColumns(elements.missingColumnPicker);

            if (!columns.length) {
                throw new Error(
                    "Select at least one column for missing-value cleaning."
                );
            }

            operations.push({
                type: "missing",
                strategy: elements.missingStrategy.value,
                columns,
                value: elements.customMissingValue?.value ?? ""
            });
        }

        if (elements.removeDuplicates?.checked) {
            operations.push({
                type: "duplicates"
            });
        }

        const textColumns = getSelectedColumns(elements.textColumnPicker);
        const textCase = elements.textCase?.value || "none";
        const trim = Boolean(elements.trimWhitespace?.checked);

        if (textColumns.length && (trim || textCase !== "none")) {
            operations.push({
                type: "text",
                columns: textColumns,
                trim,
                method: textCase
            });
        }

        return operations;
    }

    /* ========================================
       MISSING-VALUE CONTROLS
    ======================================== */

    function updateMissingValueControl() {
        if (!elements.customValueControl || !elements.missingStrategy) {
            return;
        }

        const showCustom =
            elements.missingStrategy.value === "custom";

        elements.customValueControl.style.display =
            showCustom ? "flex" : "none";
    }

    function handleApplyMissingOperation() {
        if (!app.currentDataset) {
            alert("Please upload a dataset first.");
            return;
        }

        if (
            elements.missingStrategy?.value === "custom" &&
            !elements.customMissingValue?.value.trim()
        ) {
            alert("Please enter a custom replacement value.");
            elements.customMissingValue?.focus();
            return;
        }

        if (!getSelectedColumns(elements.missingColumnPicker).length) {
            alert("Please select at least one column.");
            return;
        }

        app.missingOperationSelected = true;

        setButtonContent(
            elements.applyMissingCleaning,
            '<i data-lucide="check"></i> Operation added'
        );

        console.log("Missing-value operation added.");
    }

    /* ========================================
       CLEANING PREVIEW
    ======================================== */

    function clearCleaningPreview() {
        if (!elements.cleaningPreviewContainer) return;

        elements.cleaningPreviewContainer.innerHTML = `
            <div class="cleaning-preview-empty">
                <i data-lucide="git-compare-arrows"></i>
                <p>No preview available</p>
                <span>
                    Select cleaning operations and preview your changes here.
                </span>
            </div>
        `;

        if (elements.cleaningPreviewCount) {
            elements.cleaningPreviewCount.textContent = "No changes yet";
        }

        app.previewAvailable = false;
        refreshIcons();
    }

    function renderCleaningPreview(preview) {
        if (!elements.cleaningPreviewContainer || !preview) return;

        elements.cleaningPreviewContainer.replaceChildren();

        const summary = document.createElement("div");
        summary.className = "cleaning-preview-header";

        const description = document.createElement("span");

        description.textContent =
            `${preview.preview_count} of ${preview.total_rows} rows · Preview only`;

        summary.appendChild(description);

        elements.cleaningPreviewContainer.append(
            summary,
            createTable(preview)
        );

        refreshIcons();
    }

    async function handlePreviewCleaning() {
        if (!app.currentDataset) {
            alert("Please upload a dataset first.");
            return;
        }

        let operations;

        try {
            operations = collectCleaningOperations();
        } catch (error) {
            alert(error.message);
            return;
        }

        if (!operations.length) {
            alert("Please select at least one cleaning operation.");
            return;
        }

        if (!app.pythonReady) {
            alert("Python is not ready yet. Please wait.");
            return;
        }

        const button = elements.previewCleaning;
        const originalHTML = button?.innerHTML;

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Generating preview...";
            }

            const operationsJSON = JSON.stringify(operations);

            const result = await runPythonJSON(`
import json
import main

main.preview_cleaning(
    json.loads(${JSON.stringify(operationsJSON)})
)
            `);

            if (!result?.success) {
                throw new Error(
                    result?.message || "Unable to generate preview."
                );
            }

            renderCleaningPreview(result.preview);

            if (elements.cleaningPreviewCount) {
                elements.cleaningPreviewCount.textContent =
                    result.changes?.length
                        ? `${result.changes.length} operation(s) previewed`
                        : "Preview ready";
            }

            app.previewAvailable = true;
            app.pendingOperations = operations;

            console.log("Cleaning preview generated:", result);

        } catch (error) {
            showError("Preview failed", error);

        } finally {
            if (button) {
                button.disabled = false;

                button.innerHTML = originalHTML ||
                    '<i data-lucide="eye"></i> Preview changes';
            }

            refreshIcons();
        }
    }

    /* ========================================
       RESET CLEANING
    ======================================== */

    async function handleResetCleaning() {
        if (!app.currentDataset) {
            alert("Please upload a dataset first.");
            return;
        }

        try {
            const result = await runPythonJSON(`
import main

main.reset_dataset()
            `);

            if (!result?.success) {
                throw new Error(
                    result?.message || "Unable to reset dataset."
                );
            }

            resetControlsForNewDataset();

            getPickerCheckboxes(elements.missingColumnPicker).forEach(
                checkbox => {
                    checkbox.checked = true;
                }
            );

            updatePickerLabel(elements.missingColumnPicker);

            getPickerCheckboxes(elements.textColumnPicker).forEach(
                checkbox => {
                    checkbox.checked = false;
                }
            );

            updatePickerLabel(elements.textColumnPicker);

            clearCleaningPreview();

            console.log("Dataset reset.");

        } catch (error) {
            showError("Reset failed", error);
        }

        refreshIcons();
    }

    /* ========================================
       EXPORT CLEANED DATASET
    ======================================== */

    async function handleDownloadDataset() {
        if (!app.currentDataset) {
            alert("Please upload a dataset first.");
            return;
        }

        if (!app.pythonReady) {
            alert("Python is not ready yet.");
            return;
        }

        const button = elements.downloadCleanedDataset;
        const originalHTML = button?.innerHTML;

        try {
            if (button) {
                button.disabled = true;
                button.textContent = "Preparing download...";
            }

            const format = elements.exportFormat?.value || "csv";

            const result = await runPythonJSON(`
import main

main.export_active_dataset(
    ${JSON.stringify(format)}
)
            `);

            if (!result?.success) {
                throw new Error(
                    result?.message || "Export failed."
                );
            }

            const binary = atob(result.content_base64);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            const blob = new Blob(
                [bytes],
                { type: result.mime_type }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = result.filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            console.log("Dataset downloaded:", result.filename);

        } catch (error) {
            showError("Download failed", error);

        } finally {
            if (button) {
                button.disabled = false;

                button.innerHTML = originalHTML ||
                    '<i data-lucide="download"></i> Download cleaned dataset';
            }

            refreshIcons();
        }
    }

    /* ========================================
       EVENT LISTENERS
    ======================================== */

    function initializeCleaningControls() {
        initializeColumnPickers();

        elements.missingStrategy?.addEventListener(
            "change",
            updateMissingValueControl
        );

        elements.applyMissingCleaning?.addEventListener(
            "click",
            handleApplyMissingOperation
        );

        elements.previewCleaning?.addEventListener(
            "click",
            handlePreviewCleaning
        );

        elements.resetCleaning?.addEventListener(
            "click",
            handleResetCleaning
        );

        elements.downloadCleanedDataset?.addEventListener(
            "click",
            handleDownloadDataset
        );

        updateMissingValueControl();
    }

    /* ========================================
       APPLICATION INITIALIZATION
    ======================================== */

    async function initializeApp() {
        if (app.initialized) return;

        console.log("CleanSheet starting...");

        updateRuntimeStatus("loading", "Starting Python...");

        try {
            await window.CleanSheetPython.init();

            await window.CleanSheetPython.loadPythonFiles();

            const result = await testPython();

            app.pythonReady = true;
            app.pythonVersion = result.python_version;
            app.initialized = true;

            updateRuntimeStatus("ready", "Python ready");

            console.log("CleanSheet initialized.");
            console.log("Python:", result.python_version);
            console.log("Pandas:", result.pandas_version);
            console.log("OpenPyXL:", result.openpyxl_version);

            window.dispatchEvent(
                new CustomEvent("cleansheet:app-ready", {
                    detail: result
                })
            );

        } catch (error) {
            app.pythonReady = false;

            updateRuntimeStatus("error", "Python unavailable");

            console.error(
                "CleanSheet initialization failed:",
                error
            );
        }
    }

    function startApplication() {
        initializeNavigation();
        initializeCleaningControls();
        refreshIcons();
        initializeApp();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startApplication
        );
    } else {
        startApplication();
    }

    /* ========================================
       PUBLIC APPLICATION API
    ======================================== */

    window.CleanSheetApp = {
        state: app,
        initialize: initializeApp,
        showPage,
        updateStatistics,
        renderPreview,
        populateColumnSelects,
        renderCleaningPreview,
        getSelectedColumns
    };

})();