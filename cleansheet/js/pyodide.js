/* ========================================
   CLEANSHEET
   Pyodide Runtime Manager
======================================== */

(() => {
    "use strict";

    const PYODIDE_VERSION = "0.27.7";

    const PYODIDE_CDN =
        `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

    const PYTHON_FILES = [
        "main.py",
        "analyzer.py",
        "cleaner.py",
        "exporter.py",
        "utils.py"
    ];

    let pyodide = null;
    let initializationPromise = null;
    let modulesLoaded = false;


    /* ========================================
       STATUS EVENTS
    ======================================== */

    function updateStatus(status, message) {
        window.dispatchEvent(
            new CustomEvent("cleansheet:python-status", {
                detail: { status, message }
            })
        );

        console.log(`[CleanSheet Python] ${message}`);
    }


    /* ========================================
       LOAD PYODIDE SCRIPT
    ======================================== */

    function loadPyodideScript() {
        return new Promise((resolve, reject) => {

            if (typeof window.loadPyodide === "function") {
                resolve();
                return;
            }

            const existingScript = document.querySelector(
                'script[data-pyodide-loader]'
            );

            if (existingScript) {
                existingScript.addEventListener("load", resolve, {
                    once: true
                });

                existingScript.addEventListener("error", () => {
                    reject(
                        new Error("Unable to download the Pyodide runtime.")
                    );
                }, { once: true });

                return;
            }

            const script = document.createElement("script");

            script.src = `${PYODIDE_CDN}pyodide.js`;
            script.dataset.pyodideLoader = "true";

            script.onload = resolve;

            script.onerror = () => {
                reject(
                    new Error("Unable to download the Pyodide runtime.")
                );
            };

            document.head.appendChild(script);
        });
    }


    /* ========================================
       INITIALIZE PYTHON
    ======================================== */

    async function init() {

        if (pyodide) {
            return pyodide;
        }

        if (initializationPromise) {
            return initializationPromise;
        }

        initializationPromise = (async () => {

            try {
                updateStatus("loading", "Loading Python runtime...");

                await loadPyodideScript();

                pyodide = await window.loadPyodide({
                    indexURL: PYODIDE_CDN
                });

                updateStatus("loading", "Installing Python packages...");

                await pyodide.loadPackage([
                    "pandas",
                    "micropip"
                ]);

                await pyodide.runPythonAsync(`
import micropip
await micropip.install("openpyxl")
                `);

                updateStatus(
                    "ready",
                    "Python, Pandas and OpenPyXL are ready."
                );

                return pyodide;

            } catch (error) {

                pyodide = null;

                updateStatus("error", error.message);

                throw error;

            } finally {
                initializationPromise = null;
            }

        })();

        return initializationPromise;
    }


    /* ========================================
       LOAD PYTHON SOURCE FILES
    ======================================== */

    async function loadPythonFiles() {

        if (modulesLoaded) {
            return true;
        }

        const runtime = await init();

        updateStatus("loading", "Loading Python modules...");

        const pythonDirectory = "/home/pyodide/cleansheet";

        runtime.FS.mkdirTree(pythonDirectory);

        for (const filename of PYTHON_FILES) {

            const response = await fetch(`python/${filename}`);

            if (!response.ok) {
                throw new Error(
                    `Could not load python/${filename}`
                );
            }

            const source = await response.text();

            runtime.FS.writeFile(
                `${pythonDirectory}/${filename}`,
                source
            );
        }

        runtime.runPython(`
import sys

project_path = "/home/pyodide/cleansheet"

if project_path not in sys.path:
    sys.path.insert(0, project_path)
        `);

        modulesLoaded = true;

        updateStatus("ready", "Python modules loaded.");

        return true;
    }


    /* ========================================
       EXECUTE PYTHON
    ======================================== */

    async function runPython(code) {

        const runtime = await init();

        return runtime.runPythonAsync(code);
    }


    /* ========================================
       GET PYTHON VERSION
    ======================================== */

    async function getPythonVersion() {

        const runtime = await init();

        return runtime.runPython(
            "import sys; sys.version"
        );
    }


    /* ========================================
       WRITE FILE TO PYTHON FILESYSTEM
    ======================================== */

    async function writeFile(path, data) {

        const runtime = await init();

        const directory = path.substring(
            0,
            path.lastIndexOf("/")
        );

        if (directory) {
            runtime.FS.mkdirTree(directory);
        }

        runtime.FS.writeFile(
            path,
            new Uint8Array(data)
        );

        return true;
    }


    /* ========================================
       PUBLIC API
    ======================================== */

    window.CleanSheetPython = {
        init,
        loadPythonFiles,
        runPython,
        getPythonVersion,
        writeFile,

        get isReady() {
            return pyodide !== null;
        }
    };

})();