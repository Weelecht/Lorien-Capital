import React from 'react'
import "./Header.css"
import Navigation from '../Navigation/Navigation'

export default function Header() {
  
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <div className="Header-Container">
      <h2 onClick={scrollToTop} className="header-title">Lorien</h2>
      <Navigation />
    </div>
  )
}
