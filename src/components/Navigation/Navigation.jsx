import React, { useState, useEffect } from 'react'
import "./Navigation.css"

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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
  
  const scrollToPortfolio = () => {
    const portfolioSection = document.getElementById('portfolio');
    if (portfolioSection) {
      portfolioSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsMenuOpen(false);
  };

  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
    setIsMenuOpen(false);
  };

  const scrollToContact = () => {
    const footerSection = document.querySelector('.Footer-Container');
    if (footerSection) {
      footerSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
      
      // Trigger flash animation after scrolling
      setTimeout(() => {
        const emailElement = document.getElementById('footer-email');
        const twitterElement = document.getElementById('footer-twitter');
        
        if (emailElement) {
          emailElement.classList.add('flash');
          setTimeout(() => {
            emailElement.classList.remove('flash');
          }, 3000);
        }
        
        if (twitterElement) {
          twitterElement.classList.add('flash');
          setTimeout(() => {
            twitterElement.classList.remove('flash');
          }, 3000);
        }
      }, 800); // Wait for scroll to complete
    }
    setIsMenuOpen(false);
  };

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
        <li onClick={scrollToPortfolio}> Portfolio </li>
        <li onClick={scrollToAbout}> About </li>
        <li onClick={scrollToContact}> Contact </li>
        <li> Writings </li>
      </ul>

      {/* Mobile navigation overlay */}
      <div className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}>
        <ul className="nav-menu mobile-nav">
          <li onClick={scrollToPortfolio}> Portfolio </li>
          <li onClick={scrollToAbout}> About </li>
          <li onClick={scrollToContact}> Contact </li>
          <li> Writings </li>
        </ul>
      </div>
    </div>
  )
}
