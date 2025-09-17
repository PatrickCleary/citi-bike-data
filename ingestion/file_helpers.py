import pandas as pd
import requests
import zipfile
import io
from pathlib import Path
import os
import hashlib
import logging

logger = logging.getLogger(__name__)

def find_column_match(df_columns, possible_names):
    """Find matching column name from possibilities, case-insensitive"""
    df_columns_lower = [col.lower() for col in df_columns]
    for possible_name in possible_names:
        if possible_name.lower() in df_columns_lower:
            # Return the original column name (with original case)
            original_idx = df_columns_lower.index(possible_name.lower())
            return df_columns[original_idx]
    return None


def process_all_csvs_from_zip_url(zip_url, locale):
    """
    Download ZIP file from URL and process ALL CSV files found in any folder/subfolder.

    Parameters:
    zip_url (str): URL to the ZIP file

    Returns:
    dict: Dictionary where keys are CSV filenames and values are processed DataFrames
    """

    try:
        # Download ZIP file into memory
        logger.info(f"Downloading ZIP file from: {zip_url}")
        response = requests.get(zip_url, stream=True)
        response.raise_for_status()

        # Create a BytesIO object from the downloaded content
        zip_data = io.BytesIO(response.content)

        return process_all_csvs_from_zip_data(zip_data, locale)

    except requests.RequestException as e:
        raise Exception(f"Error downloading ZIP file: {str(e)}")
    except Exception as e:
        raise Exception(f"Error processing ZIP file: {str(e)}")


def process_all_csvs_from_zip_data(zip_data, locale):
    """
    Process all CSV files from ZIP data (works with both URL and local files).

    Parameters:
    zip_data (io.BytesIO): ZIP file data

    Returns:
    dict: Dictionary where keys are CSV filenames and values are processed DataFrames
    """

    results = {}
    processed_count = 0
    failed_files = []

    try:
        with zipfile.ZipFile(zip_data, "r") as zip_ref:
            # Get ALL files in ZIP (including subfolders)
            all_files = zip_ref.namelist()

            # Filter for CSV files (case insensitive) and exclude system/metadata files
            csv_files = []
            for f in all_files:
                # Skip directories
                if f.endswith("/"):
                    continue
                # Skip macOS metadata files
                if "__MACOSX" in f or f.startswith("._"):
                    continue
                # Skip Windows/Linux hidden files
                if "/.DS_Store" in f or f.endswith(".DS_Store"):
                    continue
                # Skip other common system files
                if f.endswith(".thumbs.db") or f.endswith("Thumbs.db"):
                    continue
                # Keep only CSV files
                if f.lower().endswith(".csv"):
                    csv_files.append(f)

            if not csv_files:
                raise ValueError("No CSV files found in ZIP archive")

            logger.info(f"Found {len(csv_files)} CSV file(s) in ZIP archive:")
            for csv_file in csv_files:
                logger.info(f"  - {csv_file}")

            # Process each CSV file
            for csv_file_path in csv_files:
                try:
                    logger.info(f"\nProcessing: {csv_file_path}")

                    # Read CSV directly from ZIP
                    with zip_ref.open(csv_file_path) as csv_file:
                        df = pd.read_csv(csv_file)

                    # Process the DataFrame based on which format it uses.
                    if "ride_id" in df.columns:
                        logger.info("here")
                        processed_df = process_dataframe(df, locale)
                    else:
                        logger.info("239821h")
                        processed_df = process_dataframe_old_format(df, locale)

                    # Use just the filename (without path) as key
                    filename_only = os.path.basename(csv_file_path)

                    # Handle duplicate filenames by adding folder info
                    if filename_only in results:
                        # Create unique key with folder path
                        folder_path = os.path.dirname(csv_file_path)
                        unique_key = (
                            f"{folder_path}/{filename_only}"
                            if folder_path
                            else filename_only
                        )
                        results[unique_key] = processed_df
                    else:
                        results[filename_only] = processed_df

                    processed_count += 1
                    logger.info(f"  ✓ Successfully processed {len(processed_df)} rows")

                except Exception as e:
                    error_msg = f"Failed to process {csv_file_path}: {str(e)}"
                    logger.info(f"  ✗ {error_msg}")
                    failed_files.append((csv_file_path, str(e)))
                    continue

            # Summary
            logger.info(f"\n{'='*50}")
            logger.info(f"PROCESSING SUMMARY:")
            logger.info(f"Successfully processed: {processed_count} files")
            logger.info(f"Failed: {len(failed_files)} files")

            if failed_files:
                logger.info(f"\nFailed files:")
                for failed_file, error in failed_files:
                    logger.info(f"  - {failed_file}: {error}")

            if processed_count == 0:
                raise ValueError("No CSV files could be processed successfully")

            return results

    except zipfile.BadZipFile:
        logger.info("File is not a valid ZIP archive, skipping.")
    except Exception as e:
        raise Exception(f"Error processing ZIP file: {str(e)}")


def process_dataframe(df, locale):
    """
    Process DataFrame to create the desired output format.

    Parameters:
    df (pd.DataFrame): Input DataFrame

    Returns:
    pd.DataFrame: Processed DataFrame
    """

    required_columns = [
        "ride_id",
        "started_at",
        "start_lat",
        "start_lng",
        "end_lat",
        "end_lng",
    ]

    # Check if all required columns exist
    missing_columns = [col for col in required_columns if col not in df.columns]

    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Create new DataFrame with only the needed columns
    result_df = pd.DataFrame()

    # Copy ride_id as-is
    result_df["ride_id"] = df["ride_id"]

    # Convert started_at to date only (remove time component)
    result_df["start_date"] = pd.to_datetime(df["started_at"]).dt.date

    # Set local to constant "JC"
    result_df["locale"] = locale

    # Copy latitude and longitude
    result_df["start_lat"] = df["start_lat"]
    result_df["start_lng"] = df["start_lng"]
    result_df["end_lat"] = df["end_lat"]
    result_df["end_lng"] = df["end_lng"]

    return result_df


# Create hashed ride_id from starttime and bikeid combination
def create_ride_id_hash(row):
    # Convert both values to strings and concatenate
    combined_string = f"{row['start_time']}_{row['bike_id']}"
    # Create SHA256 hash and take first 16 characters for shorter ID
    hash_object = hashlib.sha256(combined_string.encode())
    return hash_object.hexdigest()[:16]


def process_dataframe_old_format(df, locale):
    """
    Process DataFrame to create the desired output format.

    Parameters:
    df (pd.DataFrame): Input DataFrame
    locale: Locale identifier

    Returns:
    pd.DataFrame: Processed DataFrame
    """

    # Define column mappings with multiple possible names (all lowercase for comparison)
    column_mappings = {
        "bikeid": ["bikeid", "bike_id", "bike id"],
        "starttime": ["starttime", "start time", "start_time"],
        "start_station_latitude": [
            "start station latitude",
            "start_station_latitude",
            "start station lat",
            "start_lat",
        ],
        "start_station_longitude": [
            "start station longitude",
            "start_station_longitude",
            "start station lng",
            "start station lon",
            "start_lng",
            "start_lon",
        ],
        "end_station_latitude": [
            "end station latitude",
            "end_station_latitude",
            "end station lat",
            "end_lat",
        ],
        "end_station_longitude": [
            "end station longitude",
            "end_station_longitude",
            "end station lng",
            "end station lon",
            "end_lng",
            "end_lon",
        ],
    }

    # Find actual column names in the DataFrame
    actual_columns = {}
    missing_columns = []

    for standard_name, possible_names in column_mappings.items():
        matched_column = find_column_match(df.columns.tolist(), possible_names)
        if matched_column:
            actual_columns[standard_name] = matched_column
        else:
            missing_columns.append(
                f"{standard_name} (tried: {', '.join(possible_names)})"
            )

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}. Available columns: {df.columns.tolist()}"
        )

    # Create new DataFrame with only the needed columns
    result_df = pd.DataFrame()

    # Generate unique ride_id using hash of starttime and bikeid
    # Create a temporary series for the hash function
    temp_df = pd.DataFrame(
        {
            "start_time": df[actual_columns["starttime"]],
            "bike_id": df[actual_columns["bikeid"]],
        }
    )
    result_df["ride_id"] = temp_df.apply(create_ride_id_hash, axis=1)

    # Convert started_at to date only (remove time component)
    result_df["start_date"] = pd.to_datetime(df[actual_columns["starttime"]]).dt.date

    result_df["locale"] = locale

    # Copy latitude and longitude using the matched column names
    result_df["start_lat"] = df[actual_columns["start_station_latitude"]]
    result_df["start_lng"] = df[actual_columns["start_station_longitude"]]
    result_df["end_lat"] = df[actual_columns["end_station_latitude"]]
    result_df["end_lng"] = df[actual_columns["end_station_longitude"]]

    return result_df


def download_and_save_zip(zip_url, local_path):
    """
    Download ZIP file and save locally.

    Parameters:
    zip_url (str): URL to download
    local_path (str): Local path to save the file
    """
    try:
        logger.info(f"Downloading ZIP file to: {local_path}")
        response = requests.get(zip_url, stream=True)
        response.raise_for_status()

        # Create directory if it doesn't exist
        Path(local_path).parent.mkdir(parents=True, exist_ok=True)

        # Save file
        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        logger.info(f"ZIP file saved successfully to: {local_path}")
        return local_path

    except requests.RequestException as e:
        raise Exception(f"Error downloading ZIP file: {str(e)}")
    except Exception as e:
        raise Exception(f"Error saving ZIP file: {str(e)}")
