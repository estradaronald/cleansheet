
/* ========================================
   CLEANSHEET
   File Upload Manager
======================================== */

(() => {
    "use strict";

    /* ========================================
       CONFIGURATION
    ======================================== */

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    const ALLOWED_EXTENSIONS = [
        ".csv",
        ".xlsx"
    ];

    const UPLOAD_DIRECTORY =
        "/home/pyodide/cleansheet/uploads";


    /* ========================================
       DOM ELEMENTS
    ======================================== */

    const elements = {
        uploadArea: document.getElementById("uploadArea"),
        fileInput: document.getElementById("fileInput"),
        browseButton: document.getElementById("browseButton")
    };


    /* ========================================
       VALIDATE FILE
    ======================================== */

    function validateFile(file) {

        if (!file) {
            throw new Error("No file selected.");
        }

        const extension = file.name
            .substring(file.name.lastIndexOf("."))
            .toLowerCase();

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            throw new Error(
                "Unsupported file format. Please select a CSV or XLSX file."
            );
        }

        if (file.size === 0) {
            throw new Error("The selected file is empty.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("File exceeds the 20 MB size limit.");
        }

        return true;
    }


    /* ========================================
       GENERATE SAFE FILENAME
    ======================================== */

    function createSafeFilename(filename) {

        const extension = filename
            .substring(filename.lastIndexOf("."))
            .toLowerCase();

        const name = filename
            .substring(0, filename.lastIndexOf("."))
            .normalize("NFKD")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .replace(/_+/g, "_")
            .substring(0, 80);

        return `${name || "dataset"}${extension}`;
    }


    /* ========================================
       PROCESS UPLOADED FILE
    ======================================== */

    async function handleFile(file) {

        try {

            validateFile(file);

            if (!window.CleanSheetPython) {
                throw new Error(
                    "Python runtime is unavailable."
                );
            }

            showUploadMessage("Preparing your dataset...");

            // Initialize Python runtime
            await window.CleanSheetPython.init();

            // Load all Python source modules
            showUploadMessage("Loading Python modules...");

            await window.CleanSheetPython.loadPythonFiles();

            // Read uploaded file
            showUploadMessage("Reading your spreadsheet...");

            const buffer = await file.arrayBuffer();

            // Generate safe filename
            const safeFilename = createSafeFilename(file.name);

            const filePath =
                `${UPLOAD_DIRECTORY}/${safeFilename}`;

            // Transfer file into Pyodide filesystem
            await window.CleanSheetPython.writeFile(
                filePath,
                buffer
            );

            // Load spreadsheet using Python and Pandas
            showUploadMessage("Analyzing your dataset...");

            const pythonCode = `
from main import load_dataset

load_dataset(
    ${JSON.stringify(filePath)},
    ${JSON.stringify(file.name)}
)
            `;

            const pythonResult =
                await window.CleanSheetPython.runPython(pythonCode);

            // Parse Python response
            const datasetResult = JSON.parse(pythonResult);

            if (!datasetResult.success) {
                throw new Error(
                    datasetResult.message || "Unable to load dataset."
                );
            }

            // Prepare file information
            const fileInfo = {
                name: file.name,
                filename: safeFilename,
                extension: safeFilename
                    .substring(safeFilename.lastIndexOf("."))
                    .toLowerCase(),
                size: file.size,
                path: filePath,
                type: file.type
            };

            // Notify application with loaded dataset
            window.dispatchEvent(
                new CustomEvent("cleansheet:file-uploaded", {
                    detail: {
                        fileInfo,
                        dataset: datasetResult
                    }
                })
            );

            showUploadMessage(
                `${file.name} loaded successfully.`
            );

            console.log(
                "CleanSheet dataset loaded:",
                datasetResult
            );

            return {
                fileInfo,
                dataset: datasetResult
            };

        } catch (error) {

            showUploadMessage(error.message, true);

            console.error("Upload failed:", error);

            window.dispatchEvent(
                new CustomEvent("cleansheet:upload-error", {
                    detail: {
                        message: error.message
                    }
                })
            );

            return null;

        } finally {

            if (elements.fileInput) {
                elements.fileInput.value = "";
            }
        }
    }


    /* ========================================
       UPLOAD MESSAGE
    ======================================== */

    function showUploadMessage(message, isError = false) {

        let messageElement = document.getElementById(
            "uploadMessage"
        );

        if (!messageElement) {

            messageElement = document.createElement("p");

            messageElement.id = "uploadMessage";

            messageElement.style.marginTop = "12px";
            messageElement.style.fontSize = "12px";
            messageElement.style.textAlign = "center";

            elements.uploadArea?.appendChild(messageElement);
        }

        messageElement.textContent = message;

        messageElement.style.color = isError
            ? "#D64545"
            : "#16865C";
    }


    /* ========================================
       BROWSE FILES
    ======================================== */

    function openFileBrowser() {
        elements.fileInput?.click();
    }


    /* ========================================
       DRAG AND DROP
    ======================================== */

    function preventDefaults(event) {
        event.preventDefault();
        event.stopPropagation();
    }


    function handleDragOver(event) {

        preventDefaults(event);

        elements.uploadArea?.classList.add("drag-over");
    }


    function handleDragLeave(event) {

        preventDefaults(event);

        if (
            !elements.uploadArea?.contains(event.relatedTarget)
        ) {
            elements.uploadArea?.classList.remove("drag-over");
        }
    }


    function handleDrop(event) {

        preventDefaults(event);

        elements.uploadArea?.classList.remove("drag-over");

        const files = event.dataTransfer?.files;

        if (!files || files.length === 0) {
            return;
        }

        if (files.length > 1) {

            showUploadMessage(
                "Please upload one file at a time.",
                true
            );

            return;
        }

        handleFile(files[0]);
    }


    /* ========================================
       INITIALIZE UPLOAD EVENTS
    ======================================== */

    function initializeUpload() {

        if (
            !elements.uploadArea ||
            !elements.fileInput ||
            !elements.browseButton
        ) {
            console.error("Upload elements not found.");
            return;
        }

        elements.browseButton.addEventListener(
            "click",
            openFileBrowser
        );

        elements.fileInput.addEventListener(
            "change",
            (event) => {

                const file = event.target.files?.[0];

                if (file) {
                    handleFile(file);
                }
            }
        );

        elements.uploadArea.addEventListener(
            "dragenter",
            handleDragOver
        );

        elements.uploadArea.addEventListener(
            "dragover",
            handleDragOver
        );

        elements.uploadArea.addEventListener(
            "dragleave",
            handleDragLeave
        );

        elements.uploadArea.addEventListener(
            "drop",
            handleDrop
        );

        console.log("CleanSheet upload manager initialized.");
    }


    /* ========================================
       PUBLIC API
    ======================================== */

    window.CleanSheetUpload = {
        initialize: initializeUpload,
        handleFile,
        validateFile
    };


    /* ========================================
       START
    ======================================== */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeUpload
        );

    } else {

        initializeUpload();

    }

})();
