import React from 'react'
import "./Header.css"
import Navigation from '../Navigation/Navigation'


export default function Header() {
  return (
    <div className="Header-Container">
        <h2> Torrent </h2>
        <Navigation></Navigation>

    </div>
  )
}
