# CleanSheet – Data Cleaning Workspace

A browser-based data cleaning workspace designed to simplify dataset inspection, preprocessing, and cleaning. CleanSheet allows users to upload datasets, analyze data quality, apply cleaning operations, and export cleaned files directly from the browser.

## Overview

CleanSheet is a frontend-only application that uses **Pyodide** to execute Python directly in the browser. It provides an interactive workspace for exploring datasets and performing common data-cleaning tasks without requiring a backend server.

## Features

- **Dataset Upload** – Upload CSV and Excel (XLSX) files.
- **Data Preview** – View dataset contents in a structured table.
- **Dataset Overview** – Display total rows, columns, missing values, and duplicate rows.
- **Missing Value Handling** – Identify and manage missing data.
- **Duplicate Detection** – Identify duplicate records.
- **Data Transformation** – Apply basic cleaning operations, including text normalization.
- **Data Export** – Export cleaned datasets for further analysis.
- **Browser-Based Python** – Execute Python operations using Pyodide.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive layout |
| JavaScript | Application logic and interactions |
| Python | Data cleaning and processing |
| Pyodide | Run Python in the browser |
| Pandas | Dataset manipulation and analysis |

## Architecture

CleanSheet uses a client-side architecture. Dataset processing happens directly in the user's browser through Pyodide, eliminating the need for a traditional backend.

**Processing Workflow:**

1. Upload a CSV or XLSX dataset.
2. Load the dataset into the browser.
3. Process and analyze data using Python and Pandas.
4. Preview dataset statistics and contents.
5. Apply data-cleaning operations.
6. Export the cleaned dataset.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/CleanSheet.git
```

### 2. Open the Project

Navigate to the project directory:

```bash
cd CleanSheet
```

### 3. Run the Application

Open `index.html` in your browser or use the Live Server extension in Visual Studio Code.

No backend installation is required.



## Project Purpose

CleanSheet was developed as a practical project to explore data preprocessing, Python-based data manipulation, and browser-based data processing.

It demonstrates how Python and Pandas can be integrated into a web application without requiring a traditional backend infrastructure.

## License

This project is available for educational and portfolio purposes.
