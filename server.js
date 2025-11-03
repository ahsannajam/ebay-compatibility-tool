// Load environment variables from .env file immediately
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// --- Initialization & Configuration ---

const app = express();
const PORT = process.env.PORT || 3000;

// Use descriptive, final variables for configuration constants
const EBAY_AUTH_TOKEN = process.env.EBAY_AUTH_TOKEN;
const EBAY_API_ENDPOINT = 'https://api.ebay.com/sell/metadata/v1/compatibilities/get_multi_compatibility_property_values';
const EBAY_MARKETPLACE_ID = 'EBAY_MOTORS_US';
// Changed default category ID to match the new use case, if the frontend doesn't provide it
const DEFAULT_CATEGORY_ID = '179679'; 

// --- Helper Functions ---

/**
 * Generates a single HTML table row (<tr>) from compatibility data.
 * NOTE: Updated to extract Make and Model details from the API response.
 * @param {object} compatibility - A single compatibility item from the API response.
 * @returns {string} The HTML string for a table row.
 */
function createTableRow(compatibility) {
    // Using Object.fromEntries to create the details object
    const details = Object.fromEntries(
        compatibility.compatibilityDetails.map(detail => [detail.propertyName, detail.propertyValue])
    );

    // Extracting the new properties requested by the user
    const year = details.Year || '';
    const make = details.Make || '';
    const model = details.Model || '';
    const notes = details.Notes || ''; // Notes property is assumed to be retrieved if available

    // Removed Trim and Engine fields from the table row
    return `
<tr>
<td data-label="Year">${year}</td>
<td data-label="Make">${make}</td>
<td data-label="Model">${model}</td>
<td data-label="Notes">${notes}</td>
</tr>`;
}

/**
 * Generates the complete HTML table structure.
 * NOTE: Updated to display relevant headers (Make/Model).
 * @param {Array} responseData - The array of compatibility objects.
 * @param {object} baseFilters - The filters used for the API call (primarily Year in this case).
 * @returns {string} The complete HTML table string.
 */
function generateCompatibilityTable(responseData, baseFilters) {
    // Determine which year(s) were requested for the heading
    const requestedYears = baseFilters.Year 
        ? (Array.isArray(baseFilters.Year.propertyValue) 
           ? baseFilters.Year.propertyValue.join(', ') 
           : baseFilters.Year.propertyValue)
        : 'Unknown Year(s)';

    if (!responseData || responseData.length === 0) {
        return `<p>No compatibility data found for ${requestedYears}.</p>`;
    }

    // Use .map().join('') for efficient and cleaner list processing
    const rowsHTML = responseData.map(compatibility =>
        // Passing null for baseFilters in createTableRow as we are getting all data from the response
        createTableRow(compatibility) 
    ).join('');

    return `
<h2>Compatibility Results for Year(s): ${requestedYears}</h2>
<table class="responsive-table">
<thead>
<tr>
<th>Year</th>
<th>Make</th>
<th>Model</th>
<th>Notes</th>
</tr>
</thead>
<tbody>
${rowsHTML}
</tbody>
</table>`;
}

// --- Middleware and Routes ---

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


/**
 * POST /api/get-compatibilities: Proxies the request to the eBay API and returns an HTML table.
 */
app.post('/api/get-compatibilities', async (req, res) => {
    // ⚠️ Security Check: Use 401 if token is missing
    if (!EBAY_AUTH_TOKEN) {
        console.error("Authentication Error: eBay Token is not configured in environment variables.");
        return res.status(401).send('<p style="color: red;">Authentication Error: Server is missing required eBay credentials.</p>');
    }
    
    // Use object destructuring with default values where possible
    const { categoryId, propertyFilters, propertyNames } = req.body;

    // Use a robust method to create the baseFilters object, accounting for null/undefined
    const baseFilters = (propertyFilters || []).reduce((acc, filter) => {
        if (filter && filter.propertyName) {
            // Group multiple propertyValues into an array if Year is multi-selected
            if (acc[filter.propertyName]) {
                 if (!Array.isArray(acc[filter.propertyName].propertyValue)) {
                     acc[filter.propertyName].propertyValue = [acc[filter.propertyName].propertyValue];
                 }
                 acc[filter.propertyName].propertyValue.push(filter.propertyValue);
            } else {
                 acc[filter.propertyName] = filter;
            }
        }
        return acc;
    }, {});

    const requestBody = {
        // Use the categoryId passed from the frontend, or the new default
        categoryId: categoryId || DEFAULT_CATEGORY_ID, 
        propertyFilters: propertyFilters,
        propertyNames: propertyNames
    };

    const headers = {
        'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID
    };

    try {
        const response = await axios.post(EBAY_API_ENDPOINT, requestBody, { headers });
        // Pass baseFilters to extract Year(s) for the heading
        const htmlTable = generateCompatibilityTable(response.data.compatibilities, baseFilters);
        
        res.send(htmlTable); 
        
    } catch (error) {
        if (error.response) {
            console.error(`eBay API Response Error (${error.response.status}):`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('eBay API Request Error:', error.message);
        }
        
        res.status(502).send('<p style="color: red;">Failed to retrieve data from the eBay API. Please try again later.</p>');
    }
});

module.exports = app;
// Local Development Server Listen (omitted for brevity)