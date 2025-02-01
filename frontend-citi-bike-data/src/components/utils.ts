export const parseCSV = (csvString: string) => {
    // Split the string into lines and remove any empty lines
    const lines = csvString.trim().split('\n');
    // Create the resulting dictionary/object
    const result = {};

    // Process each data line (skip the header line)
    for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split(',');

        // The station ID is the first column
        const stationId = currentLine[0];

        // The count is the second column, convert to number
        const count = parseInt(currentLine[1]);

        // Add to result object
        result[stationId] = count;
    }

    return result;
};