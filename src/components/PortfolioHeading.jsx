import React, { useState, useEffect, useRef } from 'react'
import "./PortfolioHeading.css"

export default function PortfolioHeading() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const headingRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 50) {
        setIsScrolled(true);
      } else if (currentScrollY < 50) {
        setIsScrolled(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty dependency array

  return (
    <h1 
      ref={headingRef}
      className={`portfolio-heading ${isScrolled ? 'scrolled' : ''}`}
    >
      Portfolio
    </h1>
  )
} 