import React, { useState, useEffect, useRef } from 'react'
import { FaTwitter } from 'react-icons/fa'
import "./Card.css";

export default function Card({name, image, website, twitter, stage}) {
  const [dominantColor, setDominantColor] = useState('rgba(255, 255, 255, 0.3)');
  const [isHovered, setIsHovered] = useState(false);

  console.log('Card props:', { name, image, website, twitter, stage }); // Debug log

  useEffect(() => {
    if (image) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        // Sample pixels and find dominant color
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        const colorCounts = {};
        
        // Sample every 10th pixel for performance
        for (let i = 0; i < pixels.length; i += 40) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          
          // Skip very dark or very light pixels
          const brightness = (r + g + b) / 3;
          if (brightness > 50 && brightness < 200) {
            const color = `${r},${g},${b}`;
            colorCounts[color] = (colorCounts[color] || 0) + 1;
          }
        }
        
        // Find most common color
        let dominantColorRgb = '255,255,255';
        let maxCount = 0;
        for (const color in colorCounts) {
          if (colorCounts[color] > maxCount) {
            maxCount = colorCounts[color];
            dominantColorRgb = color;
          }
        }
        
        setDominantColor(`rgba(${dominantColorRgb}, 0.6)`);
      };
      img.src = image;
    }
  }, [image]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <a 
        href={website} 
        target="_blank" 
        rel="noopener noreferrer"
        className="card-wrapper"
        style={{ textDecoration: 'none' }}
    >
        <div 
            className={`Card-Container ${isHovered ? 'hovered' : ''}`}
            style={{ 
              backgroundImage: `url(${image})`,
              '--dominant-color': dominantColor
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >   
            <div className="card-content">
                {/* Image area - no content needed here */}
            </div>
            <div className="card-footer">
                <h3>{name}</h3>
                <div className="card-stage">[{stage}]</div>
                <div className="card-links">
                    {twitter && (
                        <a 
                            href={twitter} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="card-link"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FaTwitter />
                        </a>
                    )}
                </div>
            </div>
        </div>
    </a>
  )
}
