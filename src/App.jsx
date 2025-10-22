import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Components
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';

// Pages
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ResearchPage from './pages/ResearchPage';
import ToolsPage from './pages/ToolsPage';

// 404 Page
import NotFoundPage from './pages/NotFoundPage';

// Styles
import './App.css';

export default function App() {
  return (
    <div className="App">
      <Header/>
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/tools/*" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      
      <Footer/>
    </div>
  );
}
