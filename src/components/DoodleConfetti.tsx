import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type ParticleType = 'star' | 'coin' | 'circle' | 'checkmark' | 'squiggle'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  scale: number
  opacity: number
  color: string
  lineColor: string
  type: ParticleType
  size: number
  currencySymbol: '₩' | '$'
}

type ConfettiContextType = {
  triggerConfetti: (x?: number, y?: number) => void
}

const ConfettiContext = createContext<ConfettiContextType | undefined>(undefined)

// The hook and provider intentionally share this module and context instance.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfetti() {
  const context = useContext(ConfettiContext)
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider')
  }
  return context
}

const PALETTE = {
  good: '#218a4b',      // 초록 (정답)
  yellowSoft: '#fff3b0', // 연노랑 (프로젝트 테마)
  blueSoft: '#dff4ff',   // 연파랑 (프로젝트 테마)
  pinkSoft: '#ffd6df',   // 연분홍 (프로젝트 테마)
  ink: '#1f1f1d',        // 시그니처 검정 잉크
}

const COLORS = [PALETTE.good, PALETTE.yellowSoft, PALETTE.blueSoft, PALETTE.pinkSoft]

export function ConfettiProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const nextIdRef = useRef(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    function handleResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 애니메이션 루프
  useEffect(() => {
    let animationFrameId: number
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function updateAndDraw() {
      if (!ctx || !canvas) return
      
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const particles = particlesRef.current
      if (particles.length === 0) {
        animationFrameId = requestAnimationFrame(updateAndDraw)
        return
      }

      // 파티클 업데이트 및 드로잉
      particlesRef.current = particles.filter((p) => {
        // 물리 연산
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.28 // 중력 가속도
        p.vx *= 0.985 // 공기 저항 (속도 감쇄)
        p.vy *= 0.985
        p.rotation += p.rotationSpeed
        
        // 서서히 페이드 아웃 및 소멸 조건
        p.opacity -= 0.012
        if (p.opacity <= 0) return false

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.scale(p.scale, p.scale)
        ctx.globalAlpha = p.opacity

        // 드로잉 스타일 설정 (손그림 분필/잉크 느낌)
        ctx.fillStyle = p.color
        ctx.strokeStyle = p.lineColor
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // 셰이프 그리기
        switch (p.type) {
          case 'star': {
            ctx.beginPath()
            const spikes = 5
            const outerRadius = p.size
            const innerRadius = p.size * 0.45
            let rot = (Math.PI / 2) * 3
            const step = Math.PI / spikes

            for (let i = 0; i < spikes; i++) {
              let sx = Math.cos(rot) * outerRadius
              let sy = Math.sin(rot) * outerRadius
              ctx.lineTo(sx, sy)
              rot += step

              sx = Math.cos(rot) * innerRadius
              sy = Math.sin(rot) * innerRadius
              ctx.lineTo(sx, sy)
              rot += step
            }
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            break
          }
          case 'coin': {
            // 바깥 원
            ctx.beginPath()
            ctx.arc(0, 0, p.size, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()

            // 이중 라인 안쪽 원
            ctx.beginPath()
            ctx.arc(0, 0, p.size * 0.72, 0, Math.PI * 2)
            ctx.stroke()

            // 동전 화폐 기호 (₩ / $)
            ctx.font = `900 ${p.size * 1.1}px "sd-misaeng", "Gaegu", "Comic Sans MS", sans-serif`
            ctx.fillStyle = PALETTE.ink
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(p.currencySymbol, 0, 0.5)
            break
          }
          case 'circle': {
            // 이중 손그림 삐뚤빼뚤 원
            ctx.beginPath()
            ctx.arc(0, 0, p.size, 0, Math.PI * 1.9) // 약간 미완성 삐뚤한 동그라미
            ctx.stroke()
            
            ctx.beginPath()
            ctx.arc(1, -1, p.size * 0.85, 0.1, Math.PI * 2)
            ctx.stroke()
            break
          }
          case 'checkmark': {
            // 귀여운 체크 모양
            ctx.beginPath()
            ctx.moveTo(-p.size * 0.65, -p.size * 0.1)
            ctx.lineTo(-p.size * 0.1, p.size * 0.55)
            ctx.lineTo(p.size * 0.7, -p.size * 0.6)
            ctx.stroke()
            break
          }
          case 'squiggle': {
            // 뱅글뱅글 꼬인 꼬리선
            ctx.beginPath()
            ctx.moveTo(-p.size, -p.size * 0.2)
            ctx.bezierCurveTo(
              -p.size * 0.5, -p.size * 1.2,
              p.size * 0.5, p.size * 0.8,
              p.size, -p.size * 0.2
            )
            ctx.stroke()
            break
          }
        }

        ctx.restore()
        return true
      })

      animationFrameId = requestAnimationFrame(updateAndDraw)
    }

    animationFrameId = requestAnimationFrame(updateAndDraw)
    return () => cancelAnimationFrame(animationFrameId)
  }, [])

  function triggerConfetti(x?: number, y?: number) {
    const startX = x !== undefined ? x : window.innerWidth / 2
    const startY = y !== undefined ? y : window.innerHeight * 0.55
    const count = 45 // 적당히 풍성한 파티클 개수

    const newParticles: Particle[] = []

    for (let i = 0; i < count; i++) {
      // 랜덤 각도 및 퍼짐 속도
      const angle = Math.random() * Math.PI * 2
      const speed = 6 + Math.random() * 12

      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const types: ParticleType[] = ['star', 'coin', 'circle', 'checkmark', 'squiggle']
      const type = types[Math.floor(Math.random() * types.length)]

      newParticles.push({
        id: nextIdRef.current++,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (3 + Math.random() * 6), // 위쪽으로 조금 튀도록 보정
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        scale: 0.8 + Math.random() * 0.5,
        opacity: 1,
        color,
        lineColor: PALETTE.ink,
        type,
        size: 11 + Math.random() * 8,
        currencySymbol: Math.random() > 0.5 ? '₩' : '$',
      })
    }

    particlesRef.current = [...particlesRef.current, ...newParticles]
  }

  return (
    <ConfettiContext.Provider value={{ triggerConfetti }}>
      {children}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />
    </ConfettiContext.Provider>
  )
}
