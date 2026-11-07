
import pandas as pd


# ========================================
# DATA CLEANER
# ========================================

def remove_duplicates(df):
    """Remove duplicate rows."""
    cleaned_df = df.drop_duplicates().copy()

    return cleaned_df


def remove_missing_rows(df):
    """Remove rows containing missing values."""
    cleaned_df = df.dropna().copy()

    return cleaned_df


def fill_missing_values(df, column, value):
    """Fill missing values in a selected column."""
    cleaned_df = df.copy()

    if column not in cleaned_df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    cleaned_df[column] = cleaned_df[column].fillna(value)

    return cleaned_df


def fill_numeric_missing(df, column, method="mean"):
    """Fill missing numeric values using mean or median."""
    cleaned_df = df.copy()

    if column not in cleaned_df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if not pd.api.types.is_numeric_dtype(cleaned_df[column]):
        raise ValueError(f"Column '{column}' is not numeric.")

    if method == "mean":
        fill_value = cleaned_df[column].mean()

    elif method == "median":
        fill_value = cleaned_df[column].median()

    else:
        raise ValueError("Method must be 'mean' or 'median'.")

    if pd.isna(fill_value):
        raise ValueError(f"Column '{column}' has no usable numeric values.")

    cleaned_df[column] = cleaned_df[column].fillna(fill_value)

    return cleaned_df


def fill_text_missing(df, column):
    """Fill missing text values using the most frequent value."""
    cleaned_df = df.copy()

    if column not in cleaned_df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    mode_values = cleaned_df[column].mode(dropna=True)

    if mode_values.empty:
        raise ValueError(f"Column '{column}' has no value to use.")

    cleaned_df[column] = cleaned_df[column].fillna(mode_values.iloc[0])

    return cleaned_df


def remove_empty_columns(df):
    """Remove columns containing only missing values."""
    cleaned_df = df.dropna(axis=1, how="all").copy()

    return cleaned_df


def trim_whitespace(df, columns=None):
    """Remove leading and trailing whitespace from text columns."""
    cleaned_df = df.copy()

    selected_columns = (
        columns if columns is not None
        else cleaned_df.select_dtypes(include=["object", "string"]).columns
    )

    for column in selected_columns:
        if column not in cleaned_df.columns:
            raise ValueError(f"Column '{column}' does not exist.")

        if (
            pd.api.types.is_object_dtype(cleaned_df[column])
            or pd.api.types.is_string_dtype(cleaned_df[column])
        ):
            cleaned_df[column] = cleaned_df[column].apply(
                lambda value: value.strip()
                if isinstance(value, str)
                else value
            )

    return cleaned_df


def standardize_text(df, column, method="lower"):
    """Standardize capitalization in a selected text column."""
    cleaned_df = df.copy()

    if column not in cleaned_df.columns:
        raise ValueError(f"Column '{column}' does not exist.")

    if not (
        pd.api.types.is_object_dtype(cleaned_df[column])
        or pd.api.types.is_string_dtype(cleaned_df[column])
    ):
        raise ValueError(f"Column '{column}' is not a text column.")

    if method == "lower":
        cleaned_df[column] = cleaned_df[column].apply(
            lambda value: value.lower()
            if isinstance(value, str)
            else value
        )

    elif method == "upper":
        cleaned_df[column] = cleaned_df[column].apply(
            lambda value: value.upper()
            if isinstance(value, str)
            else value
        )

    elif method == "title":
        cleaned_df[column] = cleaned_df[column].apply(
            lambda value: value.title()
            if isinstance(value, str)
            else value
        )

    else:
        raise ValueError("Method must be 'lower', 'upper', or 'title'.")

    return cleaned_df
