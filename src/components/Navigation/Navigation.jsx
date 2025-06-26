import React from 'react'
import "./Navigation.css"

export default function Navigation() {
  
  const scrollToPortfolio = () => {
    const portfolioSection = document.getElementById('portfolio');
    if (portfolioSection) {
      portfolioSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const scrollToAbout = () => {
    const aboutSection = document.getElementById('about');
    if (aboutSection) {
      aboutSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }
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
  };

  return (
    <div className="Navigation-Container">
      <ul>
        <li onClick={scrollToPortfolio}> Portfolio </li>
        <li onClick={scrollToAbout}> About </li>
        <li onClick={scrollToContact}> Contact </li>
        <li> Writings </li>
      </ul>
    </div>
  )
}
