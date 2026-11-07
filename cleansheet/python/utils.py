
import os
import re
import math
import pandas as pd
from datetime import date, datetime


# ========================================
# JSON VALUE CONVERSION
# ========================================

def serialize_value(value):
    """Convert Pandas and Python values into JSON-safe values."""

    if value is None:
        return None

    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return int(value)

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    return str(value)


# ========================================
# FILENAME HELPERS
# ========================================

def get_file_extension(filename):
    """Return a lowercase file extension."""

    return os.path.splitext(filename)[1].lower()


def generate_safe_filename(filename):
    """Generate a filesystem-safe filename."""

    name = os.path.basename(filename)

    name = re.sub(r"[^\w.-]", "_", name)

    return name.strip("._") or "dataset"


# ========================================
# FILE VALIDATION
# ========================================

def validate_file(filename, file_size=None):
    """Validate supported file formats and optional file size."""

    allowed_extensions = [".csv", ".xlsx"]

    extension = get_file_extension(filename)

    if extension not in allowed_extensions:
        return {
            "valid": False,
            "message": "Only CSV and XLSX files are supported."
        }

    if file_size is not None:

        if file_size <= 0:
            return {
                "valid": False,
                "message": "The uploaded file is empty."
            }

        max_size = 20 * 1024 * 1024

        if file_size > max_size:
            return {
                "valid": False,
                "message": "File size exceeds the 20 MB limit."
            }

    return {
        "valid": True,
        "message": "File validation successful."
    }


# ========================================
# FILE SIZE FORMATTING
# ========================================

def format_file_size(size_bytes):
    """Convert bytes into a readable file size."""

    if size_bytes < 0:
        return "Invalid file size"

    if size_bytes < 1024:
        return f"{size_bytes} B"

    if size_bytes < 1024 ** 2:
        return f"{size_bytes / 1024:.2f} KB"

    if size_bytes < 1024 ** 3:
        return f"{size_bytes / (1024 ** 2):.2f} MB"

    return f"{size_bytes / (1024 ** 3):.2f} GB"


# ========================================
# DATASET SUMMARY
# ========================================

def get_dataset_summary(df):
    """Generate a basic summary of a DataFrame."""

    if df is None:
        return {
            "success": False,
            "message": "No dataset provided."
        }

    return {
        "success": True,
        "total_rows": int(len(df)),
        "total_columns": int(len(df.columns)),
        "total_cells": int(df.shape[0] * df.shape[1]),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "column_names": [str(column) for column in df.columns]
    }
