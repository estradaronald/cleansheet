
import os
import json
import base64
import pandas as pd

from analyzer import analyze_dataset
from cleaner import (
    remove_duplicates,
    remove_missing_rows,
    fill_missing_values,
    fill_numeric_missing,
    fill_text_missing,
    remove_empty_columns,
    trim_whitespace,
    standardize_text
)
from exporter import export_dataset
from utils import serialize_value, validate_file, get_dataset_summary


# ========================================
# DATASET STATE
# ========================================

active_dataset = None
original_dataset = None
preview_dataset = None

active_filename = None
active_filepath = None


# ========================================
# FILE READING
# ========================================

def read_dataset(filepath):
    extension = os.path.splitext(filepath)[1].lower()

    if extension == ".csv":
        try:
            return pd.read_csv(filepath, encoding="utf-8-sig")
        except UnicodeDecodeError:
            return pd.read_csv(filepath, encoding="latin1")

    if extension == ".xlsx":
        return pd.read_excel(filepath, engine="openpyxl")

    raise ValueError("Only CSV and XLSX files are supported.")


# ========================================
# STATISTICS
# ========================================

def get_dataset_statistics(df):
    summary = get_dataset_summary(df)

    if not summary["success"]:
        return summary

    total_cells = df.size
    missing = int(df.isna().sum().sum())

    return {
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "missing_values": missing,
        "duplicate_rows": int(df.duplicated().sum()),
        "completeness": round(
            ((total_cells - missing) / total_cells) * 100, 2
        ) if total_cells else 0
    }


# ========================================
# DATA PREVIEW
# ========================================

def get_dataset_preview(df, limit=50):
    preview_df = df.head(limit)

    return {
        "columns": [str(column) for column in preview_df.columns],
        "rows": [
            [serialize_value(value) for value in row.tolist()]
            for _, row in preview_df.iterrows()
        ],
        "preview_count": len(preview_df),
        "total_rows": len(df)
    }


# ========================================
# LOAD DATASET
# ========================================

def load_dataset(filepath, filename=None):
    global active_dataset
    global original_dataset
    global preview_dataset
    global active_filename
    global active_filepath

    if not os.path.exists(filepath):
        raise FileNotFoundError("Uploaded file could not be found.")

    filename = filename or os.path.basename(filepath)

    validation = validate_file(filename)

    if not validation["valid"]:
        raise ValueError(validation["message"])

    df = read_dataset(filepath)

    if len(df.columns) == 0:
        raise ValueError("The uploaded dataset has no columns.")

    original_dataset = df.copy()
    active_dataset = df.copy()
    preview_dataset = None

    active_filename = filename
    active_filepath = filepath

    return json.dumps({
        "success": True,
        "filename": filename,
        "statistics": get_dataset_statistics(active_dataset),
        "preview": get_dataset_preview(active_dataset),
        "message": "Dataset loaded successfully."
    })


# ========================================
# GET ACTIVE DATASET
# ========================================

def get_active_dataset():
    if active_dataset is None:
        raise ValueError("No dataset has been loaded.")

    return active_dataset


def get_active_filename():
    return active_filename


def get_active_filepath():
    return active_filepath


# ========================================
# DATA QUALITY ANALYSIS
# ========================================

def analyze_active_dataset():
    return json.dumps(analyze_dataset(get_active_dataset()))


# ========================================
# COLUMN SELECTION
# ========================================

def get_selected_columns(df, columns):
    """
    An empty selection means all columns.
    Invalid column names are ignored.
    """

    if not columns:
        return list(df.columns)

    selected = [
        column for column in columns
        if column in df.columns
    ]

    if not selected:
        raise ValueError("No valid columns were selected.")

    return selected


# ========================================
# MISSING VALUE CLEANING
# ========================================

def clean_missing_values(df, operation):
    strategy = operation.get("strategy")

    columns = get_selected_columns(
        df,
        operation.get("columns", [])
    )

    result = df.copy()

    if strategy == "custom":
        value = operation.get("value", "")

        for column in columns:
            result[column] = result[column].fillna(value)

    elif strategy in ("mean", "median"):

        for column in columns:

            # Only numeric columns can use mean or median.
            if not pd.api.types.is_numeric_dtype(result[column]):
                continue

            result = fill_numeric_missing(
                result,
                column,
                strategy
            )

    elif strategy == "mode":

        for column in columns:

            if result[column].isna().sum() == 0:
                continue

            mode_values = result[column].mode(dropna=True)

            if not mode_values.empty:
                result[column] = result[column].fillna(
                    mode_values.iloc[0]
                )

    elif strategy == "remove_rows":
        result = result.dropna(subset=columns)

    elif strategy == "remove_empty_columns":

        empty_columns = [
            column for column in columns
            if result[column].isna().all()
        ]

        result = result.drop(columns=empty_columns)

    else:
        raise ValueError(
            f"Unknown missing-value strategy: {strategy}"
        )

    return result


# ========================================
# TEXT FORMATTING
# ========================================

def clean_text_values(df, operation):
    result = df.copy()

    columns = get_selected_columns(
        result,
        operation.get("columns", [])
    )

    if operation.get("trim", False):
        result = trim_whitespace(result, columns)

    method = operation.get("method", "none")

    if method != "none":

        if method not in ("lower", "upper", "title"):
            raise ValueError(
                f"Unknown text formatting method: {method}"
            )

        for column in columns:

            # Apply formatting only to text-like columns.
            if (
                pd.api.types.is_object_dtype(result[column])
                or pd.api.types.is_string_dtype(result[column])
            ):
                result = standardize_text(
                    result,
                    column,
                    method
                )

    return result


# ========================================
# APPLY CLEANING OPERATIONS TO A COPY
# ========================================

def apply_operations(df, operations):
    result = df.copy()

    for operation in operations:

        operation_type = operation.get("type")

        if operation_type == "missing":
            result = clean_missing_values(
                result,
                operation
            )

        elif operation_type == "duplicates":
            result = remove_duplicates(result)

        elif operation_type == "text":
            result = clean_text_values(
                result,
                operation
            )

        else:
            raise ValueError(
                f"Unknown cleaning operation: {operation_type}"
            )

    return result


# ========================================
# PREVIEW CLEANING
# ========================================

def preview_cleaning(operations):
    global preview_dataset

    df = get_active_dataset()

    if not operations:
        raise ValueError("No cleaning operations were provided.")

    cleaned_df = apply_operations(
        df,
        operations
    )

    preview_dataset = cleaned_df.copy()

    return json.dumps({
        "success": True,
        "statistics": get_dataset_statistics(cleaned_df),
        "preview": get_dataset_preview(cleaned_df),
        "message": "Cleaning preview generated successfully."
    })


# ========================================
# APPLY PREVIEWED CLEANING
# ========================================

def apply_previewed_cleaning():
    global active_dataset
    global preview_dataset

    if preview_dataset is None:
        raise ValueError("Generate a cleaning preview first.")

    active_dataset = preview_dataset.copy()
    preview_dataset = None

    return json.dumps({
        "success": True,
        "statistics": get_dataset_statistics(active_dataset),
        "preview": get_dataset_preview(active_dataset),
        "message": "Cleaning changes applied successfully."
    })


# ========================================
# LEGACY SINGLE OPERATION
# ========================================

def clean_dataset(operation, column=None, value=None, method=None):
    global active_dataset
    global preview_dataset

    operations = []

    if operation == "remove_duplicates":
        operations = [{"type": "duplicates"}]

    elif operation == "remove_missing_rows":
        operations = [{
            "type": "missing",
            "strategy": "remove_rows",
            "columns": [column] if column else []
        }]

    elif operation == "remove_empty_columns":
        operations = [{
            "type": "missing",
            "strategy": "remove_empty_columns",
            "columns": []
        }]

    elif operation == "trim_whitespace":
        operations = [{
            "type": "text",
            "columns": [column] if column else [],
            "trim": True,
            "method": "none"
        }]

    elif operation == "fill_missing":
        operations = [{
            "type": "missing",
            "strategy": "custom",
            "columns": [column] if column else [],
            "value": value
        }]

    elif operation in ("fill_mean", "fill_median", "fill_mode"):
        strategy = operation.replace("fill_", "")

        operations = [{
            "type": "missing",
            "strategy": strategy,
            "columns": [column] if column else []
        }]

    elif operation == "standardize_text":
        operations = [{
            "type": "text",
            "columns": [column] if column else [],
            "trim": False,
            "method": method or "lower"
        }]

    else:
        raise ValueError(
            f"Unknown cleaning operation: {operation}"
        )

    active_dataset = apply_operations(
        get_active_dataset(),
        operations
    )

    preview_dataset = None

    return json.dumps({
        "success": True,
        "operation": operation,
        "statistics": get_dataset_statistics(active_dataset),
        "preview": get_dataset_preview(active_dataset),
        "message": "Cleaning operation completed."
    })


# ========================================
# RESET DATASET
# ========================================

def reset_dataset():
    global active_dataset
    global preview_dataset

    if original_dataset is None:
        raise ValueError("No original dataset is available.")

    active_dataset = original_dataset.copy()
    preview_dataset = None

    return json.dumps({
        "success": True,
        "statistics": get_dataset_statistics(active_dataset),
        "preview": get_dataset_preview(active_dataset),
        "message": "Dataset restored to its original state."
    })


# ========================================
# EXPORT DATASET
# ========================================

def export_active_dataset(file_format="csv"):
    """
    Export the preview when one exists.
    Otherwise export the active dataset.
    """

    if preview_dataset is not None:
        df = preview_dataset.copy()
    else:
        df = get_active_dataset().copy()

    result = export_dataset(
        df,
        file_format
    )

    return json.dumps({
        "success": True,
        "filename": result["filename"],
        "content_base64": base64.b64encode(
            result["content"]
        ).decode("ascii"),
        "mime_type": result["mime_type"]
    })


# ========================================
# CLEAR DATASET
# ========================================

def clear_dataset():
    global active_dataset
    global original_dataset
    global preview_dataset
    global active_filename
    global active_filepath

    active_dataset = None
    original_dataset = None
    preview_dataset = None

    active_filename = None
    active_filepath = None

    return True
