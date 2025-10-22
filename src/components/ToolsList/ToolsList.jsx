import React from 'react'
import './ToolsList.css'

function ToolsList({ projects }) {
  if (!projects || !projects.tools) {
    return <p>No projects available</p>
  }

  return (
    <div className="tools-container">
      <header className="header">
        <h1 className="header-title">Lorien-Tools</h1>
      </header>
      
      <ul className="projects-list">
        {projects.tools.map((project, index) => (
          <li key={index} className="project-item">
            <a href={project.url} target="_blank" rel="noopener noreferrer">
              {project.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ToolsList
