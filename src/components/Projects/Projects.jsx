import React from 'react'
import { useState,useEffect } from 'react'
import { getProjects } from '../../api/helper'
import Card from '../Card/Card'
import "./Projects.css"

export default function Projects() {

  const [projects,setProjects] = useState([]);

  useEffect(()=> {
    const fetchProjects = async() => {
      try {
        const _projects = await getProjects();
        console.log(_projects);
        setProjects(_projects);

      } catch(error) {
        console.log(error);
      }
    }

    fetchProjects();
  },[])


  return (
    <div className='Projects-Container'>
      <h2>Direct Investment</h2>
      <div className='Direct-Investment-Container'>
        {projects.length !== 0 ? projects.Direct?.map((investment, key) => {
          return (
            <Card key={key} {...investment}/>
          ) 
        }) : (
          <div className="loading-text">Loading portfolio companies...</div>
        )}
      </div>
    </div>
  )
}
