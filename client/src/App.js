import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [years, setYears] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Generate list of years (2001 → current year)
    const currentYear = new Date().getFullYear();
    const y = [];
    for (let i = currentYear; i >= 2001; i--) y.push(i);
    setYears(y);
  }, []);

  // ✅ Fetch Makes
  const fetchMakes = async (selectedYear) => {
    setYear(selectedYear);
    setMake('');
    setModel('');
    setMakes([]);
    setModels([]);

    if (!selectedYear) return;

    try {
      const res = await axios.post('/api/get-makes', { year: selectedYear });
      setMakes(res.data.makes || []);
    } catch (err) {
      console.error('Error fetching makes:', err);
      alert('Failed to load makes.');
    }
  };

  // ✅ Fetch Models
  const fetchModels = async (selectedMake) => {
    setMake(selectedMake);
    setModel('');
    setModels([]);

    if (!selectedMake || !year) return;

    try {
      const res = await axios.post('/api/get-models', { year, make: selectedMake });
      setModels(res.data.models || []);
    } catch (err) {
      console.error('Error fetching models:', err);
      alert('Failed to load models.');
    }
  };

  // ✅ Fetch Compatibility Data
  const getCompatibility = async () => {
    if (!year || !make || !model) {
      alert('Please select Year, Make, and Model.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/get-compatibilities', {
        categoryId: '33560',
        propertyFilters: [
          { propertyName: 'Year', propertyValue: year },
          { propertyName: 'Make', propertyValue: make },
          { propertyName: 'Model', propertyValue: model },
        ],
        propertyNames: ['Trim', 'Engine'],
      });

      document.getElementById('results').innerHTML = res.data;
    } catch (err) {
      console.error('Error fetching compatibility:', err);
      alert('Failed to fetch compatibility data.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Export CSV/XLSX
  const exportData = async (format = 'csv') => {
    const table = document.querySelector('#results table');
    if (!table) return alert('No data to export.');

    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
    );

    const jsonData = rows.map(row =>
      Object.fromEntries(headers.map((header, i) => [header, row[i]]))
    );

    try {
      const res = await axios.post('/api/export-compatibilities', { data: jsonData, format }, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compatibility.${format}`;
      a.click();
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data.');
    }
  };

  return (
    <div className="App" style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>eBay Vehicle Compatibility Finder</h1>

      {/* Dropdowns Section */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* Year */}
        <select
          value={year}
          onChange={(e) => fetchMakes(e.target.value)}
          style={{ padding: '8px', minWidth: '150px' }}
        >
          <option value="">Select Year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Make */}
        <select
          value={make}
          onChange={(e) => fetchModels(e.target.value)}
          disabled={!makes.length}
          style={{ padding: '8px', minWidth: '150px' }}
        >
          <option value="">Select Make</option>
          {makes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Model */}
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!models.length}
          style={{ padding: '8px', minWidth: '150px' }}
        >
          <option value="">Select Model</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <button
          onClick={getCompatibility}
          disabled={loading}
          style={{
            padding: '8px 12px',
            background: '#007bff',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Get Compatibility'}
        </button>
      </div>

      {/* Results */}
      <div id="results" style={{ marginTop: '20px' }}></div>

      {/* Export Buttons */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => exportData('csv')}
          style={{
            padding: '8px 12px',
            background: 'green',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
        <button
          onClick={() => exportData('xlsx')}
          style={{
            padding: '8px 12px',
            background: 'orange',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Export XLSX
        </button>
      </div>
    </div>
  );
}

export default App;
