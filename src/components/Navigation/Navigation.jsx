import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import "./Navigation.css"

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.Navigation-Container')) {
        setIsMenuOpen(false);
      }
    };

    // Close menu on escape key
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset'; // Restore scroll
    };
  }, [isMenuOpen]);
  

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="Navigation-Container">
      {/* Mobile hamburger menu */}
      <button 
        className={`hamburger-menu ${isMenuOpen ? 'open' : ''}`}
        onClick={toggleMenu}
        aria-label="Toggle navigation menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Desktop navigation */}
      <ul className="nav-menu desktop-nav">
        <li><Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
        <li><Link to="/about" onClick={() => setIsMenuOpen(false)}>About</Link></li>
        <li><Link to="/research" onClick={() => setIsMenuOpen(false)}>Research</Link></li>
        <li><Link to="/tools" onClick={() => setIsMenuOpen(false)}>Tools</Link></li>
      </ul>

      {/* Mobile navigation overlay */}
      <div className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}>
        <ul className="nav-menu mobile-nav">
          <li><Link to="/" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
          <li><Link to="/about" onClick={() => setIsMenuOpen(false)}>About</Link></li>
          <li><Link to="/research" onClick={() => setIsMenuOpen(false)}>Research</Link></li>
          <li><Link to="/tools" onClick={() => setIsMenuOpen(false)}>Tools</Link></li>
        </ul>
      </div>
    </div>
  )
}
