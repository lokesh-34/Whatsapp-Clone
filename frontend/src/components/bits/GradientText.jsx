/**
 * React Bits — GradientText
 * https://www.reactbits.dev/text-animations/gradient-text
 * Smoothly animated gradient flowing through text
 */
import { useState, useCallback, useRef } from 'react'
import { motion, useMotionValue, useAnimationFrame, useTransform } from 'framer-motion'

export default function GradientText({
  children,
  className = '',
  colors = ['#00A884', '#4ECDC4', '#00A884'],
  animationSpeed = 6,
  showBorder = false,
  pauseOnHover = false,
}) {
  const [isPaused, setIsPaused] = useState(false)
  const progress = useMotionValue(0)
  const elapsedRef = useRef(0)
  const lastTimeRef = useRef(null)
  const animationDuration = animationSpeed * 1000

  useAnimationFrame((time) => {
    if (isPaused) { lastTimeRef.current = null; return }
    if (lastTimeRef.current === null) { lastTimeRef.current = time; return }
    const delta = time - lastTimeRef.current
    lastTimeRef.current = time
    elapsedRef.current += delta
    const fullCycle = animationDuration * 2
    const cycleTime = elapsedRef.current % fullCycle
    if (cycleTime < animationDuration) {
      progress.set((cycleTime / animationDuration) * 100)
    } else {
      progress.set(100 - ((cycleTime - animationDuration) / animationDuration) * 100)
    }
  })

  const backgroundPosition = useTransform(progress, (p) => `${p}% 50%`)

  const handleMouseEnter = useCallback(() => { if (pauseOnHover) setIsPaused(true) }, [pauseOnHover])
  const handleMouseLeave = useCallback(() => { if (pauseOnHover) setIsPaused(false) }, [pauseOnHover])

  const gradientColors = [...colors, colors[0]].join(', ')
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${gradientColors})`,
    backgroundSize: '300% 100%',
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
      {children}
    </motion.span>
  )
}
