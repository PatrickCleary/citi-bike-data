import pandas as pd
import h3
import logging

logger = logging.getLogger(__name__)


def apply_h3_latlng_to_cell(df_by_file, resolution=9) -> dict[str, pd.DataFrame]:
    output_obj = {}
    for key in df_by_file.keys():
        logger.info(f"[{key}] entries: {df_by_file[key].shape[0]}")
        resolution = 9
        df_in_loop = df_by_file[key].copy()
        df_in_loop["h3_cell_start"] = df_in_loop.apply(
            lambda row: (
                h3.latlng_to_cell(row["start_lat"], row["start_lng"], resolution)
                if pd.notnull(row["start_lat"]) and pd.notnull(row["start_lng"])
                else None
            ),
            axis=1,
        )
        df_in_loop["h3_cell_end"] = df_in_loop.apply(
            lambda row: (
                h3.latlng_to_cell(row["end_lat"], row["end_lng"], resolution)
                if pd.notnull(row["end_lat"]) and pd.notnull(row["end_lng"])
                else None
            ),
            axis=1,
        )

        df_in_loop.drop(
            columns=["start_lat", "start_lng", "end_lat", "end_lng"], inplace=True
        )
        # Remove duplicates. These are infrequent and probably just bad data.
        dupes = df_in_loop.duplicated(subset=["ride_id"])
        logger.info(f"  - Removing {dupes.sum()} duplicate ride_id entries")
        df_in_loop = df_in_loop[~dupes]

        output_obj[key] = df_in_loop
    return output_obj
