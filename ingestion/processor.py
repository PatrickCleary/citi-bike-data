from io import StringIO
import logging
from datetime import datetime
import pandas as pd
from supabase import create_client, Client
import json
import psycopg2

from file_helpers import process_all_csvs_from_zip_url
from geo_helpers import apply_h3_latlng_to_cell

logger = logging.getLogger(__name__)


class BikeShareProcessor:
    def __init__(self, conn_details, supabase_client):
        self.conn_details = conn_details
        self.create_new_connection()
        self.supabase_client = supabase_client

    def reset_connection(self):
        """Create a new connection"""
        try:
            self.conn.close()
        except:
            pass
        self.create_new_connection()
        self.connection_created_at = datetime.now()
        logger.info("Database connection reset successfully")

    def create_new_connection(self):
        self.conn = psycopg2.connect(**self.conn_details)

    def process_files_df(self, files: pd.DataFrame):
        for _, file in files.iterrows():
            self.reset_connection()
            output = self.fetch_and_process_file(file)
            if output:
                self.upload_output_obj(output, table_name="ride_data")
                self.mark_file_as_processed(file)
            else:
                print(f"No data processed for {file['file_name']}, skipping upload.")

    def fetch_and_process_file(self, file: pd.Series):
        print(f"Processing file: {file['file_name']} for locale {file['locale']}")
        url = f"https://s3.amazonaws.com/tripdata/{file['file_name']}"
        df_by_file = process_all_csvs_from_zip_url(url, locale=file["locale"])
        if not df_by_file:
            print(f"No data processed for {file['file_name']}, skipping upload.")
        else:
            output = apply_h3_latlng_to_cell(df_by_file)
        return output

    def upload_output_obj(self, output_obj: dict[str, pd.DataFrame], table_name: str):
        for key in output_obj.keys():
            print(f"Uploading {key} with {output_obj[key].shape[0]} records")
            self.upload_df(output_obj[key], table_name)

    def upload_df(self, df: pd.DataFrame, table_name: str, chunk_size=50000):
        for i in range(0, len(df), chunk_size):
            print(f"uploading chunk {i/ chunk_size}")
            chunk = df.iloc[i : i + 50000]
            self.bulk_insert_with_staging(chunk, table_name)

    def bulk_insert_with_staging(self, df: pd.DataFrame, table_name: str):
        """
        High-performance bulk insert using staging table and COPY with UPSERT capability.
        Updates existing records and inserts new ones.
        """
        if len(df) == 0:
            return {"inserted": 0, "updated": 0}

        logger.info(f"Bulk upserting {len(df)} records to {table_name}")

        with self.conn.cursor() as cur:
            # Create temporary staging table
            staging_table = f"staging_{table_name}_{int(datetime.now().timestamp())}"

            cur.execute(
                f"""
                CREATE TEMP TABLE {staging_table} (LIKE {table_name} INCLUDING ALL)
                ON COMMIT DROP
                """
            )

            # Use COPY to load data into staging table (fastest method)
            output = StringIO()
            df.to_csv(output, sep="\t", header=False, index=False, na_rep="\\N")
            output.seek(0)

            # Build COPY command with correct column list
            columns = ", ".join(df.columns)
            copy_sql = f"COPY {staging_table} ({columns}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N')"

            cur.copy_expert(copy_sql, output)

            # Get all columns except the conflict resolution columns for the UPDATE SET clause
            all_columns = list(df.columns)
            conflict_columns = [
                "ride_id",
                "start_date",
                "locale",
            ]  # Your unique constraint columnsF
            update_columns = [col for col in all_columns if col not in conflict_columns]

            # Build the SET clause for updates
            set_clause = ", ".join(
                [f"{col} = EXCLUDED.{col}" for col in update_columns]
            )

            # Perform UPSERT operation
            upsert_sql = f"""
                INSERT INTO {table_name} ({columns})
                SELECT {columns} FROM {staging_table}
                ON CONFLICT (ride_id, start_date, locale) 
                DO UPDATE SET {set_clause}
            """

            cur.execute(upsert_sql)

            cur.execute(upsert_sql)
            total_processed = len(df)

            self.conn.commit()

            logger.info(
                f"Successfully processed {total_processed} records in {table_name}"
            )

            return {"total_processed": total_processed}

    def mark_file_as_processed(self, file_obj):
        print(f"Marking file {file_obj['file_name']} as completed")
        result = (
            supabase.table("processed_files")
            .upsert(
                self.get_processed_file_record(file_obj),
                on_conflict="file_name,locale",
            )
            .execute()
        )
        print(result)

    def get_processed_file_record(self, file_df_entry):
        json_str = file_df_entry.to_json(date_format="iso")
        data = json.loads(json_str)
        return data


if __name__ == "__main__":
    import dotenv
    import os
    import sys

    dotenv.load_dotenv()
    conn_details = {
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
        "dbname": os.getenv("DB_NAME"),
    }
    if len(sys.argv) < 2:
        print("Usage: python processor.py <file_name>")
        sys.exit(1)

    file_name = sys.argv[1]
    print(f"Processing file: {file_name}")
    files_df = pd.read_csv(file_name)
    if not all(
        col in files_df.columns.to_list()
        for col in ["file_name", "last_modified", "locale"]
    ):
        raise ValueError(
            "Input CSV must contain 'file_name', 'last_modified', and 'locale' columns"
        )
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    supabase: Client = create_client(supabase_url, supabase_key)
    processor = BikeShareProcessor(conn_details=conn_details, supabase_client=supabase)
    processor.process_files_df(files_df)
