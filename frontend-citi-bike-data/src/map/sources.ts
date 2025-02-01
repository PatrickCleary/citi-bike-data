import type {
    SourceSpecification,
} from 'mapbox-gl';

export const STATION_SOURCE_ID = 'stations'

export const STATIONS_SOURCE: SourceSpecification = {
    type: 'geojson',
    // data must be present. Previously it was set to empty string '' and it tries to fetch data from the current URL.
    data: `/map_data/stations.geojson`,
    promoteId: 'id'

};

