import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function TypingIndicator() {
  const dotsRef = useRef([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(dotsRef.current, {
        y: -6, duration: 0.38, ease: 'sine.inOut',
        stagger: 0.13, repeat: -1, yoyo: true,
      })
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="typing-indicator-row" style={{ padding: '0 8%' }}>
      <div className="typing-bubble">
        {[0, 1, 2].map((i) => (
          <div key={i} className="typing-dot" ref={(el) => (dotsRef.current[i] = el)} />
        ))}
      </div>
    </div>
  )
}
