import React, { useState, useEffect, useRef } from 'react'
import Projects from '../Projects/Projects'
import "./Content.css"

export default function Content() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const contentRef = useRef(null);
  const headingRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Trigger immediately when scrolling down
      if (currentScrollY > 50) {
        setIsScrolled(true);
        console.log('Scroll: Adding scrolled class, scrollY:', currentScrollY);
      } 
      // Revert when scrolling up to near the top
      else if (currentScrollY < 50) {
        setIsScrolled(false);
        console.log('Scroll: Removing scrolled class, scrollY:', currentScrollY);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty dependency array

  return (
    <div className='Content-Container' ref={contentRef}>  
        <h1 
          ref={headingRef}
          className={`portfolio-heading ${isScrolled ? 'scrolled' : ''}`}
        >
          Portfolio
        </h1>
        <Projects />
    </div>
  )
}
