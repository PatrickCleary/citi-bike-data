import requests
import pandas as pd
from bs4 import BeautifulSoup


class FileDownloader:
    def __init__(
        self, supabase_client, base_url: str = "https://s3.amazonaws.com/tripdata/"
    ):
        self.base_url = base_url
        self.supabase_client = supabase_client

    def get_unprocessed_files(self):
        """
        Get files which have not been processed yet.F

        Returns:
            _type_: _description_
        """
        # Previously processed files which we have in the database.
        prev_files = self.get_prev_processed_files()
        # Files live on the website.
        live_files = self.get_live_files()
        # Get new files which have not been processed. The difference between the two.
        new_files = self.get_new_files(live_files, prev_files)
        new_files["locale"] = new_files["file_name"].apply(
            lambda x: "JC" if x.startswith("JC") else "NYC"
        )
        return new_files

    def get_prev_processed_files(self):
        """Get records from database. These are the files we have already processed including last modified date from the citibike website.

        Returns:
            _type_: _description_
        """
        result = self.supabase_client.table("processed_files").select("*").execute()
        prev_files = pd.DataFrame(result.data)
        return prev_files

    def get_live_files(self):
        """Get the current files from the citibike website.

        Returns:
            _type_: _description_
        """
        response = requests.get("https://s3.amazonaws.com/tripdata")
        response.raise_for_status()  # Ensure we notice bad responses
        current_files = self.parse_citibike_xml_to_df(response.text)
        return current_files

    def get_new_files(self, live_files, prev_files):
        # Method 1: Using merge with indicator
        merged = live_files.merge(
            prev_files,
            on="file_name",
            how="left",
            suffixes=("_new", "_old"),
            indicator=True,
        )

        # Filter for rows that either:
        # 1) Don't appear in old_df (_merge == 'left_only')
        # 2) Appear in old_df but have newer last_modified date
        filtered_df = merged[
            (merged["_merge"] == "left_only")  # Not in old_df
            | (
                merged["last_modified_new"] > merged["last_modified_old"]
            )  # Newer modification date
        ][["file_name", "last_modified_new"]].rename(
            columns={"last_modified_new": "last_modified"}
        )
        return filtered_df

    def parse_citibike_xml_to_df(self, xml_content):
        """
        Parse the Citibike S3 bucket XML listing into a pandas DataFrame

        Args:
            xml_content (str): The XML content from the S3 bucket listing

        Returns:
            pd.DataFrame: DataFrame with columns 'filename', 'last_modified', 'size_bytes'
        """

        # Parse the XML
        soup = BeautifulSoup(xml_content, "xml")

        # Find all Contents elements
        contents = soup.find_all("Contents")

        # Extract data from each file
        file_data = []

        for content in contents:
            # Get the filename (Key)
            key = content.find("Key")
            filename = key.text if key else None

            # Get the last modified date
            last_modified = content.find("LastModified")
            last_modified_date = last_modified.text if last_modified else None

            # Get the file size
            size = content.find("Size")
            size_bytes = int(size.text) if size else None

            # Add to our data list
            if filename:  # Only add if we have a filename
                file_data.append(
                    {
                        "file_name": filename,
                        "last_modified": last_modified_date,
                    }
                )

        # Create DataFrame
        df = pd.DataFrame(file_data)

        # Convert last_modified to datetime
        if not df.empty and "last_modified" in df.columns:
            df["last_modified"] = pd.to_datetime(df["last_modified"])

        return df


if __name__ == '__main__':
    from supabase import create_client
    import os
    import dotenv

    dotenv.load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    supabase = create_client(supabase_url, supabase_key)

    downloader = FileDownloader(supabase)
    new_files_df = downloader.get_unprocessed_files()
    print(new_files_df)