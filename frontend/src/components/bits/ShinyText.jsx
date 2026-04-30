/**
 * React Bits — ShinyText
 * https://www.reactbits.dev/text-animations/shiny-text
 * Animated shimmer sweep across text
 */
import { useState, useCallback, useRef } from 'react'
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'framer-motion'

const ShinyText = ({
  text,
  disabled = false,
  speed = 3,
  className = '',
  color = '#8696A0',
  shineColor = '#ffffff',
  spread = 120,
  pauseOnHover = false,
}) => {
  const [isPaused, setIsPaused] = useState(false)
  const progress = useMotionValue(0)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef(null)

  const animationDuration = speed * 1000

  useAnimationFrame((time) => {
    if (disabled || isPaused) { lastTimeRef.current = null; return }
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return }
    const delta = time - lastTimeRef.current
    lastTimeRef.current = time
    elapsedRef.current += delta
    const cycleTime = elapsedRef.current % animationDuration
    progress.set((cycleTime / animationDuration) * 100)
  })

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`)

  const handleMouseEnter = useCallback(() => { if (pauseOnHover) setIsPaused(true) }, [pauseOnHover])
  const handleMouseLeave = useCallback(() => { if (pauseOnHover) setIsPaused(false) }, [pauseOnHover])

  const gradientStyle = {
    backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block',
  }

  return (
    <motion.span
      className={className}
      style={{ ...gradientStyle, backgroundPosition }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </motion.span>
  )
}

export default ShinyText
