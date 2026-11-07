
import pandas as pd


# ========================================
# DATA QUALITY ANALYZER
# ========================================

def analyze_dataset(df):
    """
    Analyze a Pandas DataFrame and return
    a complete data quality report.
    """

    if df is None or df.empty:
        return {
            "success": False,
            "message": "No dataset available for analysis."
        }

    total_rows = len(df)
    total_columns = len(df.columns)
    total_cells = total_rows * total_columns

    # ------------------------------------
    # GENERAL STATISTICS
    # ------------------------------------

    missing_values = int(df.isna().sum().sum())
    duplicate_rows = int(df.duplicated().sum())

    empty_columns = [
        str(column)
        for column in df.columns
        if df[column].isna().all()
    ]

    # ------------------------------------
    # COLUMN ANALYSIS
    # ------------------------------------

    column_analysis = []

    for column in df.columns:

        series = df[column]

        missing_count = int(series.isna().sum())
        non_missing_count = int(series.notna().sum())
        unique_count = int(series.nunique(dropna=True))
        duplicate_count = int(
            series[series.notna()].duplicated().sum()
        )

        missing_percentage = (
            round((missing_count / total_rows) * 100, 2)
            if total_rows > 0 else 0
        )

        completeness = (
            round((non_missing_count / total_rows) * 100, 2)
            if total_rows > 0 else 0
        )

        column_analysis.append({
            "column": str(column),
            "data_type": str(series.dtype),
            "total_values": total_rows,
            "missing_values": missing_count,
            "missing_percentage": missing_percentage,
            "unique_values": unique_count,
            "duplicate_values": duplicate_count,
            "completeness": completeness,
            "is_empty": bool(non_missing_count == 0)
        })

    # ------------------------------------
    # DATA QUALITY SCORE
    # ------------------------------------

    completeness_score = (
        ((total_cells - missing_values) / total_cells) * 100
        if total_cells > 0 else 0
    )

    duplicate_score = (
        ((total_rows - duplicate_rows) / total_rows) * 100
        if total_rows > 0 else 0
    )

    quality_score = round(
        (completeness_score * 0.7) +
        (duplicate_score * 0.3),
        2
    )

    # ------------------------------------
    # QUALITY STATUS
    # ------------------------------------

    if quality_score >= 90:
        quality_status = "Excellent"
    elif quality_score >= 75:
        quality_status = "Good"
    elif quality_score >= 50:
        quality_status = "Needs Improvement"
    else:
        quality_status = "Poor"

    # ------------------------------------
    # FINAL REPORT
    # ------------------------------------

    return {
        "success": True,
        "summary": {
            "total_rows": total_rows,
            "total_columns": total_columns,
            "total_cells": total_cells,
            "missing_values": missing_values,
            "duplicate_rows": duplicate_rows,
            "empty_columns": len(empty_columns),
            "completeness_score": round(completeness_score, 2),
            "duplicate_score": round(duplicate_score, 2),
            "quality_score": quality_score,
            "quality_status": quality_status
        },
        "empty_column_names": empty_columns,
        "columns": column_analysis
    }
