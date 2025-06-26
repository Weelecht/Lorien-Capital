import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="Footer-Container">
      <div className="footer-content">
        <div className="footer-section">
          <h3 className="footer-title">Disclaimer</h3>
          <p className="footer-description">
            Lorien is a personally funded initiative and is therefore not open to external capital.         </p>
        </div>
        
        <div className="footer-section">
          <h4 className="footer-subtitle">Contact</h4>
          <div className="footer-links">
            <a href="mailto:hello@lorien.capital" className="footer-link" id="footer-email">
              contact@lorien.capital
            </a>
            <a href="https://x.com/LorienCapital" className="footer-link" id="footer-twitter" target="_blank" rel="noopener noreferrer">
              @LorienCapital
            </a>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <div className="footer-divider"></div>
        <p className="footer-copyright">
          © {currentYear} Lorien Capital. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
