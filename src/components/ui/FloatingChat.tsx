'use client'

import { MessageCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const CHAT_URL = 'https://lin.ee/YOUR_LINK'
const BUTTON_SIZE = 56
const EDGE_PADDING = 8
const SNAP_PADDING = 24
const INITIAL_RIGHT = 24
const INITIAL_BOTTOM = 96

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getInitialPosition() {
  return {
    x: window.innerWidth - BUTTON_SIZE - INITIAL_RIGHT,
    y: window.innerHeight - BUTTON_SIZE - INITIAL_BOTTOM,
  }
}

export function FloatingChat() {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isSnapping, setIsSnapping] = useState(false)
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 })
  const movedRef = useRef(false)
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clampPosition = (nextPosition: { x: number; y: number }) => ({
      x: clamp(nextPosition.x, EDGE_PADDING, window.innerWidth - BUTTON_SIZE - EDGE_PADDING),
      y: clamp(nextPosition.y, EDGE_PADDING, window.innerHeight - BUTTON_SIZE - EDGE_PADDING),
    })

    setPosition(clampPosition(getInitialPosition()))

    const handleResize = () => {
      setPosition((current) => clampPosition(current ?? getInitialPosition()))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current)
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!position) return
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current)

    setIsSnapping(false)
    movedRef.current = false
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: position.x,
      y: position.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    const deltaX = event.clientX - dragStartRef.current.pointerX
    const deltaY = event.clientY - dragStartRef.current.pointerY

    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      movedRef.current = true
    }

    setPosition({
      x: clamp(dragStartRef.current.x + deltaX, EDGE_PADDING, window.innerWidth - BUTTON_SIZE - EDGE_PADDING),
      y: clamp(dragStartRef.current.y + deltaY, EDGE_PADDING, window.innerHeight - BUTTON_SIZE - EDGE_PADDING),
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (movedRef.current) {
      setPosition((current) => {
        if (!current) return current

        const isLeftSide = current.x + BUTTON_SIZE / 2 < window.innerWidth / 2
        return {
          x: isLeftSide ? SNAP_PADDING : window.innerWidth - BUTTON_SIZE - SNAP_PADDING,
          y: clamp(current.y, EDGE_PADDING, window.innerHeight - BUTTON_SIZE - EDGE_PADDING),
        }
      })

      setIsSnapping(true)
      snapTimerRef.current = setTimeout(() => setIsSnapping(false), 320)
    }
  }

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (movedRef.current) {
      event.preventDefault()
      movedRef.current = false
    }
  }

  const preventNativeDrag = (event: React.DragEvent<HTMLAnchorElement>) => {
    event.preventDefault()
  }

  return (
    <a
      href={CHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact Line OA"
      draggable={false}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      onDragStart={preventNativeDrag}
      style={position ? { left: position.x, top: position.y } : undefined}
      className={[
        'fixed z-40 flex h-14 w-14 touch-none select-none items-center justify-center',
        'rounded-full bg-[#06C755] text-white shadow-xl shadow-[#06C755]/30',
        'hover:scale-105 hover:shadow-2xl hover:shadow-[#06C755]/40 active:scale-95',
        isSnapping ? 'transition-[left,top,box-shadow,transform] duration-300 ease-out' : 'transition-shadow duration-200',
        position ? '' : 'bottom-24 right-6',
      ].join(' ')}
    >
      <span className="pointer-events-none" draggable={false}>
        <MessageCircle className="h-7 w-7" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-background bg-emerald-300" />
    </a>
  )
}
