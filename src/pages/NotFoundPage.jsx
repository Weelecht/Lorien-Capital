import React from 'react';
import { Link } from 'react-router-dom';
import './NotFoundPage.css';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-container">
        <div className="cat-container">
          <h1 className="error-title">404</h1>
          <img 
            src="/rupert-cat.gif" 
            alt="Surprised cat" 
            className="cat-gif"
          />
        </div>
        
        <div className="button-container">
          <Link to="/" className="back-home-btn">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
