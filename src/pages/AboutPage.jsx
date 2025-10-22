import React from 'react';

export default function AboutPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: '6rem'
    }}>
      <h1 style={{ 
        fontSize: '3rem',
        fontWeight: '700',
        background: 'linear-gradient(135deg, #00ffff 0%, #ffffff 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      }}>
        About
      </h1>
    </div>
  );
}
