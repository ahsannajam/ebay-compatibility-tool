const axios = require('axios');

// --- START: Configuration ---

// NOTE: The 'Bearer' token should be securely stored in an environment variable or .env file.
// For this example, we'll try to load it from a simple .env setup if available,
// but you must replace 'YOUR_EBAY_AUTH_TOKEN' with your actual token.
const EBAY_AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN || 'YOUR_EBAY_AUTH_TOKEN'; 

const API_ENDPOINT = 'https://api.sandbox.ebay.com/sell/metadata/v1/compatibilities/get_multi_compatibility_property_values';
const MARKETPLACE_ID = 'EBAY_MOTORS_US';

// The filters used in the request body
const requestFilters = {
    Year: { propertyName: "Year", propertyValue: "2014" },
    Make: { propertyName: "Make", propertyValue: "Ram" },
    Model: { propertyName: "Model", propertyValue: "1500" }
};

// The properties we want returned (Engine and Trim are the variable ones)
const propertiesToReturn = [
    "Engine",
    "Trim",
    "Year"
];

// --- END: Configuration ---

/**
 * Generates the HTML table row structure from a single compatibility object.
 * @param {object} compatibility - A single compatibility item from the API response.
 * @param {object} baseFilters - The Make/Model/Year used in the original request.
 * @returns {string} The HTML string for a table row.
 */
function createTableRow(compatibility, baseFilters) {
    const details = {};

    // Map compatibilityDetails array to a simple key-value object
    compatibility.compatibilityDetails.forEach(detail => {
        details[detail.propertyName] = detail.propertyValue;
    });

    // Extract necessary values, falling back to an empty string if property is missing
    const year = details.Year || baseFilters.Year.propertyValue;
    const make = baseFilters.Make.propertyValue; // Constant from the request
    const model = baseFilters.Model.propertyValue; // Constant from the request
    const trim = details.Trim || '';
    const engine = details.Engine || '';
    const notes = details.Notes || ''; // Notes is not requested but good to include

    return `
<tr>
<td data-label="Year">${year}</td>
<td data-label="Make">${make}</td>
<td data-label="Model">${model}</td>
<td data-label="Trim">${trim}</td>
<td data-label="Engine">${engine}</td>
<td data-label="Notes">${notes}</td>
</tr>`;
}


/**
 * Generates the complete HTML table structure.
 * @param {object} responseData - The 'compatibilities' array from the API response.
 * @param {object} baseFilters - The filters used for the API call.
 * @returns {string} The complete HTML table string.
 */
function generateCompatibilityTable(responseData, baseFilters) {
    if (!responseData || responseData.length === 0) {
        return '<p>No compatibility data found for the selected criteria.</p>';
    }

    let tableHTML = `
<h2>Compatibility Results for ${baseFilters.Year.propertyValue} ${baseFilters.Make.propertyValue} ${baseFilters.Model.propertyValue}</h2>
<table class="responsive-table">
<thead>
<tr>
<th>Year</th>
<th>Make</th>
<th>Model</th>
<th>Trim</th>
<th>Engine</th>
<th>Notes</th>
</tr>
</thead>
<tbody>`;

    responseData.forEach(compatibility => {
        tableHTML += createTableRow(compatibility, baseFilters);
    });

    tableHTML += `
</tbody>
</table>`;

    return tableHTML;
}


/**
 * Main function to fetch data and generate the table.
 */
async function fetchAndGenerateTable() {
    console.log(`\nFetching compatibility data for ${requestFilters.Year.propertyValue} ${requestFilters.Make.propertyValue} ${requestFilters.Model.propertyValue}...\n`);

    const requestBody = {
        categoryId: "33560", // Category ID for Parts & Accessories
        propertyFilters: Object.values(requestFilters),
        propertyNames: propertiesToReturn
    };

    const headers = {
        'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID
    };

    try {
        const response = await axios.post(API_ENDPOINT, requestBody, { headers });
        const responseBody = response.data;

        const htmlOutput = generateCompatibilityTable(responseBody.compatibilities, requestFilters);
        
        // Output the resulting HTML to the console
        console.log("--- Generated HTML Table ---");
        console.log(htmlOutput);
        console.log("----------------------------");

    } catch (error) {
        console.error('An error occurred during the API call:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error(`Status: ${error.response.status}`);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error message:', error.message);
        }
    }
}

fetchAndGenerateTable();