import React from 'react';

export default function SherlockHlPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      color: '#ffffff',
      padding: '2rem',
      paddingTop: '8rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '2.5rem',
          color: '#00ffff',
          marginBottom: '2rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          fontFamily: "'Courier New', 'Monaco', 'Consolas', monospace"
        }}>
          Sherlock-Hl
        </h1>
        <div style={{
          background: '#111',
          border: '1px solid #333',
          padding: '2rem',
          borderRadius: '4px'
        }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#ccc' }}>
            Advanced data analysis and pattern recognition tool for high-level insights.
          </p>
          <p style={{ color: '#a0aec0' }}>
            This tool is currently under development. More features and functionality will be available soon.
          </p>
        </div>
      </div>
    </div>
  );
}
