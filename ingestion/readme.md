# Ingestion Process Steps

1. Fetch S3 XML data to get all file names
2. Compare existing processed files to new files. If any new files appear, process that file. If any file has a `last_modified` value that doesn't match previous, process that file.
3. The processed file database should also store the raw zip/csv in s3 and a link to that so we don't lose data? `ProcessedFile` entries do not get deleted, they are just marked as `inactive`


### Processing a file

1. Create entries for all stations – geom, name, ID, month (is it possible a station moves within a month – maybe but let's just pretend not)
2. If any station values for that month exist already, delete them (this is for the case when the data has been updated).
3. Once station values are created, process the trip data. Create a row for each trip-pair. i.e. `MonthlyTrip`


### Handling marker display
1. On a given month, get all relevant station objects in geojson form.
2. When a station/group of stations is selected, fetch all relevant CSVs.
3. Now do we take those values, sum them per station, and adjust the sizes of the markers ? Or should we create a new geojson with those values and return that? 


### Open Questions

- Storing the data – should I just use S3? Will already basically be indexed on date and station ID. Can just store accordingly and then fetch.
- Would need a separate bucket/folder for storing origins/destinations. This is how blue bike data works now anyway.