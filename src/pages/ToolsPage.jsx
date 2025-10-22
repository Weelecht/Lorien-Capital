import { useState, useEffect } from 'react'
import ToolsList from '../components/ToolsList/ToolsList'
import './ToolsPage.css'

function ToolsPage() {

  const [projects, setProject] = useState();

  useEffect(()=> {
    const fetchData = async() => {
      const res = await fetch(`/data/tools.json`);
      const data = await res.json();
      console.log(data.tools[0])
      setProject(data); 
    }

    fetchData();
  },[])

  return (
    <div className="tools-page">
      {projects ? (
        <ToolsList projects={projects} />
      ) : (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading tools...</p>
        </div>
      )}
    </div>
  )
}

export default ToolsPage
