/**
 * React Bits — SpotlightCard
 * https://www.reactbits.dev/components/spotlight-card
 * Mouse-tracking spotlight glow effect on a card
 */
import { useRef } from 'react'
import './SpotlightCard.css'

const SpotlightCard = ({
  children,
  className = '',
  spotlightColor = 'rgba(0, 168, 132, 0.18)',
}) => {
  const divRef = useRef(null)

  const handleMouseMove = (e) => {
    const rect = divRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    divRef.current.style.setProperty('--mouse-x', `${x}px`)
    divRef.current.style.setProperty('--mouse-y', `${y}px`)
    divRef.current.style.setProperty('--spotlight-color', spotlightColor)
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`card-spotlight ${className}`}
    >
      {children}
    </div>
  )
}

export default SpotlightCard
