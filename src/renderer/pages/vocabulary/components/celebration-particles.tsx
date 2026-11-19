import { memo } from 'react'

export const CelebrationParticles = memo(function CelebrationParticles() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-primary/30"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
            animation: `float ${3 + Math.random() * 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  )
})
