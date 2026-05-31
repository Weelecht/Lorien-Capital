import React, { useState, useEffect, useRef } from 'react'
import Projects from '../Projects/Projects'
import "./Content.css"

export default function Content() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const contentRef = useRef(null);

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
    <div className='Content-Container' ref={contentRef}>  
      <Projects />
    </div>
  )
}
