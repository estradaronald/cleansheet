
import io
import pandas as pd


# ========================================
# DATA EXPORTER
# ========================================

def export_csv(df):
    """Export a DataFrame as CSV bytes."""

    if df is None:
        raise ValueError("No dataset available to export.")

    output = io.StringIO()

    df.to_csv(
        output,
        index=False,
        encoding="utf-8"
    )

    return output.getvalue().encode("utf-8-sig")


def export_excel(df):
    """Export a DataFrame as Excel bytes."""

    if df is None:
        raise ValueError("No dataset available to export.")

    output = io.BytesIO()

    df.to_excel(
        output,
        index=False,
        engine="openpyxl"
    )

    return output.getvalue()


def export_dataset(df, file_format="csv"):
    """
    Export a DataFrame based on the selected format.

    Supported formats:
    - csv
    - xlsx
    """

    if df is None:
        raise ValueError("No dataset available to export.")

    if file_format == "csv":
        return {
            "filename": "cleansheet_export.csv",
            "content": export_csv(df),
            "mime_type": "text/csv"
        }

    elif file_format == "xlsx":
        return {
            "filename": "cleansheet_export.xlsx",
            "content": export_excel(df),
            "mime_type": (
                "application/vnd.openxmlformats-officedocument."
                "spreadsheetml.sheet"
            )
        }

    else:
        raise ValueError(
            "Unsupported format. Choose 'csv' or 'xlsx'."
        )
