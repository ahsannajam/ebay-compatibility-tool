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
const DEFAULT_CATEGORY_ID = '33560'; // Stored as a constant for clarity

// --- Helper Functions ---

/**
 * Generates a single HTML table row (<tr>) from compatibility data.
 * @param {object} compatibility - A single compatibility item from the API response.
 * @param {object} baseFilters - The Make/Model/Year used in the original request.
 * @returns {string} The HTML string for a table row.
 */
function createTableRow(compatibility, baseFilters) {
    // Using Object.fromEntries to create the details object is a modern, clean approach
    const details = Object.fromEntries(
        compatibility.compatibilityDetails.map(detail => [detail.propertyName, detail.propertyValue])
    );

    // Defaulting to empty strings for missing data improves stability
    const year = details.Year || baseFilters.Year?.propertyValue || '';
    const make = baseFilters.Make?.propertyValue || '';
    const model = baseFilters.Model?.propertyValue || '';
    const trim = details.Trim || '';
    const engine = details.Engine || '';
    const notes = details.Notes || '';

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
 * @param {Array} responseData - The array of compatibility objects.
 * @param {object} baseFilters - The filters used for the API call.
 * @returns {string} The complete HTML table string.
 */
function generateCompatibilityTable(responseData, baseFilters) {
    const displayMake = baseFilters.Make?.propertyValue || 'Vehicle';

    if (!responseData || responseData.length === 0) {
        return `<p>No compatibility data found for ${displayMake}.</p>`;
    }

    // Use .map().join('') for efficient and cleaner list processing instead of string concatenation
    const rowsHTML = responseData.map(compatibility =>
        createTableRow(compatibility, baseFilters)
    ).join('');

    return `
<h2>Compatibility Results for ${displayMake}</h2>
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
<tbody>
${rowsHTML}
</tbody>
</table>`;
}

// --- Middleware and Routes ---

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files correctly


/**
 * POST /api/get-compatibilities: Proxies the request to the eBay API and returns an HTML table.
 */
app.post('/api/get-compatibilities', async (req, res) => {
    if (!EBAY_AUTH_TOKEN) {
        console.error("Authentication Error: eBay Token is not configured in environment variables.");
        return res.status(401).send('<p style="color: red;">Authentication Error: Server is missing required eBay credentials.</p>');
    }

    const { categoryId, propertyFilters, propertyNames } = req.body;
    const baseFilters = (propertyFilters || []).reduce((acc, filter) => {
        if (filter && filter.propertyName) acc[filter.propertyName] = filter;
        return acc;
    }, {});

    // Extract all selected years (may be multiple)
    const selectedYears = propertyFilters
        .filter(f => f.propertyName === "Year")
        .map(f => f.propertyValue);

    // Common headers and constants
    const headers = {
        'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID
    };

    const requestBodyTemplate = {
        categoryId: categoryId || DEFAULT_CATEGORY_ID,
        propertyNames
    };

    try {
        // Send parallel requests for each selected year
        const yearRequests = selectedYears.map(async (year) => {
            const yearFilters = propertyFilters.filter(f => f.propertyName !== "Year");
            yearFilters.push({ propertyName: "Year", propertyValue: year });

            const response = await axios.post(EBAY_API_ENDPOINT, {
                ...requestBodyTemplate,
                propertyFilters: yearFilters
            }, { headers });

            return response.data.compatibilities || [];
        });

        // Await all year requests
        const results = await Promise.allSettled(yearRequests);

        // Collect and flatten all fulfilled results
        const mergedData = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);

        if (mergedData.length === 0) {
            return res.send(`<p>No compatibility data found for ${baseFilters.Make?.propertyValue || 'Vehicle'}.</p>`);
        }

        // Generate final HTML table combining all years
        const htmlTable = generateCompatibilityTable(mergedData, baseFilters);
        res.send(htmlTable);

    } catch (error) {
        console.error('eBay API Request Error:', error.response?.data || error.message);
        res.status(502).send('<p style="color: red;">Failed to retrieve data from the eBay API. Please try again later.</p>');
    }
});

/**
 * GET available Makes for a specific Year
 */
app.post('/api/get-makes', async (req, res) => {
    const { year } = req.body;

    if (!EBAY_AUTH_TOKEN) {
        return res.status(401).json({ error: 'Missing eBay Token' });
    }

    if (!year) {
        return res.status(400).json({ error: 'Year is required' });
    }

    try {
        const response = await axios.post(
            'https://api.ebay.com/sell/metadata/v1/compatibilities/get_compatibility_property_values',
            {
                categoryId: DEFAULT_CATEGORY_ID,
                propertyFilters: [{ propertyName: 'Year', propertyValue: year }],
                propertyName: 'Make'
            },
            {
                headers: {
                    'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID
                }
            }
        );

        const makes = response.data.propertyValues || [];
        res.json({ makes });

    } catch (error) {
        console.error('Error fetching makes:', error.response?.data || error.message);
        res.status(502).json({ error: 'Failed to fetch makes' });
    }
});

/**
 * GET available Models for a specific Year and Make
 */
app.post('/api/get-models', async (req, res) => {
    const { year, make } = req.body;

    if (!EBAY_AUTH_TOKEN) {
        return res.status(401).json({ error: 'Missing eBay Token' });
    }

    if (!year || !make) {
        return res.status(400).json({ error: 'Year and Make are required' });
    }

    try {
        const response = await axios.post(
            'https://api.ebay.com/sell/metadata/v1/compatibilities/get_compatibility_property_values',
            {
                categoryId: DEFAULT_CATEGORY_ID,
                propertyFilters: [
                    { propertyName: 'Year', propertyValue: year },
                    { propertyName: 'Make', propertyValue: make }
                ],
                propertyName: 'Model'
            },
            {
                headers: {
                    'Authorization': `Bearer ${EBAY_AUTH_TOKEN}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-EBAY-C-MARKETPLACE-ID': EBAY_MARKETPLACE_ID
                }
            }
        );

        const models = response.data.propertyValues || [];
        res.json({ models });

    } catch (error) {
        console.error('Error fetching models:', error.response?.data || error.message);
        res.status(502).json({ error: 'Failed to fetch models' });
    }
});


// 🟢 Vercel Export: This is the entry point for Vercel's serverless function.
module.exports = app;

// Local Development Server Listen (Optional for Vercel, but kept for local testing)

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
