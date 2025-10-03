from dotenv import load_dotenv
import os
import sys
import logging
from pathlib import Path
from supabase import create_client
from file_downloader import FileDownloader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("logs/fetch_files.log"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


def main():
    """Main function to fetch new files and save to CSV"""
    try:
        logger.info("Starting file fetch process...")
        # Load environment variables
        load_dotenv()
        # Initialize Supabase client
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            logger.error("Missing Supabase credentials in environment variables")
            sys.exit(1)

        supabase = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialized successfully")

        # Initialize file downloader
        downloader = FileDownloader(supabase)

        # Get unprocessed files
        logger.info("Fetching unprocessed files...")
        new_files_df = downloader.get_unprocessed_files()

        if new_files_df.empty:
            logger.info("No new files found")
            # Create empty CSV file to indicate no files
            new_files_df.to_csv("new_files.csv", index=False)
        else:
            logger.info(f"Found {len(new_files_df)} new files to process")

            # Log file details
            for _, file in new_files_df.iterrows():
                logger.info(
                    f"New file: {file['file_name']} (locale: {file['locale']}, modified: {file['last_modified']})"
                )

            # Save to CSV for processing step
            new_files_df.to_csv("new_files.csv", index=False)
            logger.info("New files saved to new_files.csv")

        logger.info("File fetch process completed successfully")

    except Exception as e:
        logger.error(f"Error in file fetch process: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    # Ensure logs directory exists
    Path("logs").mkdir(exist_ok=True)
    main()
