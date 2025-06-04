import React from 'react'
import "./Card.css";

export default function Card({name, image, website, twitter}) {

  return (
    <div 
        className='Card-Container'
        style={{ backgroundImage: `url(${image})` }}
    >   
        <div className="card-content">
            <h3>{name}</h3>
            <div className="card-links">
                {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer" className="card-link">
                        Website
                    </a>
                )}
                {twitter && (
                    <a href={twitter} target="_blank" rel="noopener noreferrer" className="card-link">
                        Twitter
                    </a>
                )}
            </div>
        </div>
    </div>
  )
}
