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

// Tool Pages
import SherlockHlPage from './pages/tools/SherlockHlPage';
import TapespeedHlPage from './pages/tools/TapespeedHlPage';
import ModularDashboardPage from './pages/tools/ModularDashboardPage';

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
        <Route path="/tools/sherlock-hl" element={<SherlockHlPage />} />
        <Route path="/tools/tapespeed-hl" element={<TapespeedHlPage />} />
        <Route path="/tools/modular-dashboard" element={<ModularDashboardPage />} />
      </Routes>
      
      <Footer/>
    </div>
  );
}
