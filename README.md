# Citi Bike Data

An app that allows you to see where citi bike trips are taken from/to each month.

## Data sets

### Adding data layers

The source-layer name is equivalent to the name given as the `file_name`

automated process: 
research/layer_generation/layer_generation.ipynb

1. arcgis to GEOJSON
2. tippecanoe -o <file_name>.mbtiles <file_name>.geojson --force
3. pmtiles convert <file_name>.mbtiles <file_name>.pmtiles

**Citi Bike data**

- CSV source https://s3.amazonaws.com/tripdata/index.html

### PATH

**lines**

- map source: https://hudson-county-gis-hudsoncogis.hub.arcgis.com/datasets/HudsonCoGIS::path-train/explore?layer=0&location=40.740405%2C-74.069207%2C13.90

- arcgis feature layer URL: https://services3.arcgis.com/Stu7jwuXrnM0myT0/arcgis/rest/services/PATH_Train/FeatureServer

**stations**

- map source: https://hudson-county-gis-hudsoncogis.hub.arcgis.com/datasets/HudsonCoGIS::path-train/explore?layer=29&location=40.742314%2C-73.991268%2C11.67

- https://services3.arcgis.com/Stu7jwuXrnM0myT0/arcgis/rest/services/PATH_Train/FeatureServer

### NYC Subway

**lines**

- map source: https://www.arcgis.com/apps/mapviewer/index.html?layers=973c3760224a4970b3152a4667fc7da5

- arcgis feature layer URL https://services5.arcgis.com/OKgEWPlJhc3vFb8C/arcgis/rest/services/MTA_Subway_Routes_Stops/FeatureServer/1

**stations**

- map source: https://www.arcgis.com/apps/mapviewer/index.html?layers=973c3760224a4970b3152a4667fc7da5

- arcgis feature layer URL https://services5.arcgis.com/OKgEWPlJhc3vFb8C/arcgis/rest/services/MTA_Subway_Routes_Stops/FeatureServer/0

### **NJ Transit**

**light rail lines**

- map source: https://njogis-newjersey.opendata.arcgis.com/datasets/b432bf3bf40f40da9d43fa955b834274_0/explore

- arcgis feature layer URL https://services6.arcgis.com/M0t0HPE53pFK525U/arcgis/rest/services/NJTransit_Light_Rail/FeatureServer

**light rail stations**

- map: https://njogis-newjersey.opendata.arcgis.com/datasets/7877bb73757d4b1586338ccf2168705d_0/explore

- arcgis feature layer URL: https://services6.arcgis.com/M0t0HPE53pFK525U/arcgis/rest/services/NJTransit_Light_Rail_Stations/FeatureServer

**rail lines**

- map source: https://njogis-newjersey.opendata.arcgis.com/datasets/e6701817be974795aecc7f7a8cc42f79_0/explore

- arcgis feature layer URL: https://services6.arcgis.com/M0t0HPE53pFK525U/arcgis/rest/services/NJTRANSIT_RAIL_LINES_1/FeatureServer

**rail stations**

- map source: https://njogis-newjersey.opendata.arcgis.com/datasetss/4809dada94c542e0beff00600ee930f6_0/explore

- arcgis feature layer URL: https://services6.arcgis.com/M0t0HPE53pFK525U/arcgis/rest/services/NJTransit_Rail_Stations/FeatureServer

<!--
### **LIRR**
 - source: https://hub.arcgis.com/documents/DCP::long-island-railroad-stations-mta/about?path=

 - arcgis feature layer URL:  -->


### NYC bike lanes

- https://data.cityofnewyork.us/dataset/New-York-City-Bike-Routes/mzxg-pwib/data_preview