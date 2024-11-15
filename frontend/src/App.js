import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import * as d3 from 'd3-dsv';
import { VegaLite } from 'react-vega';

function App() {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([]);
  const [tableData, setTableData] = useState(null);
  const [error, setError] = useState('');
  const [vegaSpec, setVegaSpec] = useState(null);
  const [csvFile, setCsvFile] = useState(null); // Add state for CSV file
  const chartRef = useRef(null);


  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:8001/query', { prompt });
      const parsedData = res.data;
  
      console.log('Response data:', parsedData); // Log the response to confirm structure
  
      // Add the user's prompt and the backend's response to the messages
      setMessages([...messages, { prompt, response: parsedData.response }]);
      setPrompt('');
  
      // Parse the Vega-Lite specification if it's wrapped in the "response" field
      let vegaSpec;
      if (parsedData.response) {
        try {
          vegaSpec = JSON.parse(parsedData.response); // Parse the JSON string in "response"
        } catch (error) {
          console.error('Failed to parse Vega-Lite spec from response', error);
          return;
        }
      } else {
        vegaSpec = parsedData; // Use parsedData directly if it's already the Vega spec
      }
  
      // Set the Vega-Lite spec
      if (vegaSpec.$schema && vegaSpec.data && (vegaSpec.mark || vegaSpec.layer || vegaSpec.facet || vegaSpec.hconcat || vegaSpec.vconcat || vegaSpec.concat || vegaSpec.repeat)) {
        setVegaSpec(vegaSpec);
      } else {
        console.error('Invalid Vega-Lite specification received from the backend.');
      }
    } catch (error) {
      console.error('Error querying the backend:', error);
    }
  };
  
  
  
  
  
  
  const handleFileChange = (file) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a valid CSV file.');
      return;
    }
    setError('');
    const formData = new FormData();
    formData.append('file', file);
  
    axios.post('http://localhost:8001/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    .then((response) => {
      console.log(response.data.message);
      const reader = new FileReader();
      reader.onload = () => {
        const data = d3.csvParse(reader.result, d3.autoType);
        setTableData(data.slice(0, 10)); // Preview first 10 rows
      };
      reader.onerror = () => setError('Error reading file');
      reader.readAsText(file);
    })
    .catch((error) => {
      console.error('Error uploading file:', error);
      setError('Error uploading file.');
    });
  };
  

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // const embedChart = (data) => {
  //   const spec = {
  //     $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  //     data: { values: data },
  //     mark: 'bar',
  //     encoding: {
  //       x: { field: Object.keys(data[0])[0], type: 'ordinal' },
  //       y: { field: Object.keys(data[0])[1], type: 'quantitative' }
  //     }
  //   };
  //   setVegaSpec(spec);
  // };

  const embedChart = (parsedData) => {
    try {
      const spec = {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: parsedData.data.values },
        mark: parsedData.mark,
        encoding: parsedData.encoding
      };
      setVegaSpec(spec);
    } catch (error) {
      console.error('Error setting up Vega-Lite spec', error);
    }
  };
  

  return (
    <div className="App" onDragOver={handleDragOver} onDrop={handleDrop}>
      <header className="App-header">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt"
          />
          <button type="submit">Submit</button>
        </form>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => handleFileChange(e.target.files[0])}
        />
        {error && <div className="error">{error}</div>}
        <div className="message-history">
          {messages.map((msg, index) => (
            <div key={index} className="message">
              <div className="prompt">{msg.prompt}</div>
              <div className="response">{msg.response}</div>
            </div>
          ))}
        </div>
        {tableData && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  {Object.keys(tableData[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {vegaSpec && (
           <div className="chart-container">
          <VegaLite spec={vegaSpec} />
          </div>
        )}
      </header>
    </div>
  );
  }

export default App;
