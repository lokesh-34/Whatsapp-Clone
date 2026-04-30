/**
 * React Bits — StarBorder
 * https://www.reactbits.dev/components/star-border
 * Animated star/glow border around a container
 */
import { motion } from 'framer-motion'
import './StarBorder.css'

export default function StarBorder({
  children,
  className = '',
  color = '#00A884',
  speed = '6s',
  thickness = 1,
}) {
  return (
    <div className={`star-border-container ${className}`} style={{ '--star-color': color, '--border-width': `${thickness}px`, '--anim-speed': speed }}>
      <div className="star-border-inner">{children}</div>
      <div className="star-border-track">
        <div className="star-border-star" />
      </div>
    </div>
  )
}
