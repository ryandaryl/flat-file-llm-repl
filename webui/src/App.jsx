import React, { useState, useRef } from 'react';

export default function App() {
  const [status, setStatus] = useState('Click the button to start');
  const intervalRef = useRef(null);

  const runJob = async () => {
    // Clear any existing intervals if clicked repeatedly
    if (intervalRef.current) clearInterval(intervalRef.current);

    const jobId = "job_" + Math.random().toString(36).substring(7);
    setStatus("Starting...");

    try {
      // 1. Trigger the background process
      await fetch(`/api/task/start/${jobId}`, { method: 'POST' });

      // 2. Poll the status endpoint every 1 second until it finishes
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/task/status/${jobId}`);
          const data = await res.json();
          setStatus(`Status: ${data.status}`);

          if (data.status.includes("Successfully")) {
            clearInterval(intervalRef.current);
          }
        } catch (err) {
          setStatus("Error checking status");
          clearInterval(intervalRef.current);
        }
      }, 1000);
    } catch (err) {
      setStatus("Error starting job");
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '50px' }}>
      <button 
        onClick={runJob} 
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        Run Background Process
      </button>
      <h3 style={{ marginTop: '20px', color: '#333' }}>{status}</h3>
    </div>
  );
}
