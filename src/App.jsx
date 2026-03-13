import { useState, useEffect, useCallback, useRef } from 'react'
import './index.scss'

const TICK_INTERVAL = 150
const INFINITY = 9999

// Square grid directions
const SQUARE_DIRECTIONS = {
  up: { emoji: '⬆️', dx: 0, dy: -1 },
  down: { emoji: '⬇️', dx: 0, dy: 1 },
  left: { emoji: '⬅️', dx: -1, dy: 0 },
  right: { emoji: '➡️', dx: 1, dy: 0 },
}

// Diagonal combinations (for when two adjacent directions are equidistant)
const DIAGONAL_MAP = {
  'up+right': '↗️',
  'up+left': '↖️',
  'down+right': '↘️',
  'down+left': '↙️',
}

// Hex grid directions (pointy-top, odd-r offset)
const HEX_DIRECTIONS = {
  e: { emoji: '➡️', getOffset: () => ({ dx: 1, dy: 0 }) },
  w: { emoji: '⬅️', getOffset: () => ({ dx: -1, dy: 0 }) },
  ne: { emoji: '↗️', getOffset: (isOddRow) => ({ dx: isOddRow ? 1 : 0, dy: -1 }) },
  nw: { emoji: '↖️', getOffset: (isOddRow) => ({ dx: isOddRow ? 0 : -1, dy: -1 }) },
  se: { emoji: '↘️', getOffset: (isOddRow) => ({ dx: isOddRow ? 1 : 0, dy: 1 }) },
  sw: { emoji: '↙️', getOffset: (isOddRow) => ({ dx: isOddRow ? 0 : -1, dy: 1 }) },
}

const EXIT_EMOJI = '🚪'

function App() {
  const [rows, setRows] = useState(6)
  const [cols, setCols] = useState(8)
  const [tiles, setTiles] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [highlightedPath, setHighlightedPath] = useState([])
  const [allowDiagonals, setAllowDiagonals] = useState(false)
  const [isHexGrid, setIsHexGrid] = useState(false)
  const tickRef = useRef(0)

  // Get the current direction set based on grid type
  const getDirections = useCallback(() => {
    return isHexGrid ? HEX_DIRECTIONS : SQUARE_DIRECTIONS
  }, [isHexGrid])

  // Initialize empty neighbor distances based on grid type
  const getEmptyNeighborDistances = useCallback(() => {
    if (isHexGrid) {
      return { e: INFINITY, w: INFINITY, ne: INFINITY, nw: INFINITY, se: INFINITY, sw: INFINITY }
    }
    return { up: INFINITY, down: INFINITY, left: INFINITY, right: INFINITY }
  }, [isHexGrid])

  // Initialize grid
  const initializeGrid = useCallback(() => {
    const newTiles = []
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        newTiles.push({
          id: `${x}-${y}`,
          x,
          y,
          isExit: false,
          distance: INFINITY,
          direction: null,
          neighborDistances: getEmptyNeighborDistances(),
        })
      }
    }
    setTiles(newTiles)
    setIsRunning(false)
    setHighlightedPath([])
    tickRef.current = 0
  }, [rows, cols, getEmptyNeighborDistances])

  // Initialize on mount and when dimensions/grid type change
  useEffect(() => {
    initializeGrid()
  }, [initializeGrid])

  // Get tile at position
  const getTileAt = useCallback((tilesArr, x, y) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return null
    return tilesArr.find(t => t.x === x && t.y === y)
  }, [cols, rows])

  // Get neighbor position based on direction and grid type
  const getNeighborPos = useCallback((tile, dir) => {
    if (isHexGrid) {
      const isOddRow = tile.y % 2 === 1
      const offset = HEX_DIRECTIONS[dir].getOffset(isOddRow)
      return { x: tile.x + offset.dx, y: tile.y + offset.dy }
    } else {
      const d = SQUARE_DIRECTIONS[dir]
      return { x: tile.x + d.dx, y: tile.y + d.dy }
    }
  }, [isHexGrid])

  // Determine display direction (handles diagonals for square grid)
  const getDisplayDirection = useCallback((neighborDistances, minDistance) => {
    const minDirs = Object.entries(neighborDistances)
      .filter(([_, dist]) => dist === minDistance)
      .map(([dir]) => dir)

    // For hex grid or no diagonals, just return first direction
    if (isHexGrid || !allowDiagonals || minDirs.length === 1) {
      return { direction: minDirs[0], emoji: getDirections()[minDirs[0]].emoji }
    }

    // Check for diagonal combinations (square grid only)
    const hasUp = minDirs.includes('up')
    const hasDown = minDirs.includes('down')
    const hasLeft = minDirs.includes('left')
    const hasRight = minDirs.includes('right')

    if (hasUp && hasRight) return { direction: 'up+right', emoji: DIAGONAL_MAP['up+right'] }
    if (hasUp && hasLeft) return { direction: 'up+left', emoji: DIAGONAL_MAP['up+left'] }
    if (hasDown && hasRight) return { direction: 'down+right', emoji: DIAGONAL_MAP['down+right'] }
    if (hasDown && hasLeft) return { direction: 'down+left', emoji: DIAGONAL_MAP['down+left'] }

    // Fallback to first direction
    return { direction: minDirs[0], emoji: getDirections()[minDirs[0]].emoji }
  }, [isHexGrid, allowDiagonals, getDirections])

  // Calculate path from a tile to the nearest exit
  const calculatePath = useCallback((startTile) => {
    if (!startTile || startTile.distance === INFINITY) return []

    const path = []
    let current = startTile
    const visited = new Set()

    while (current && !visited.has(current.id)) {
      path.push(current.id)
      visited.add(current.id)

      if (current.isExit) break

      if (current.direction) {
        // Handle diagonal directions for square grid
        let nextPos
        if (current.direction.includes('+')) {
          // Diagonal - pick first component direction
          const [dir1] = current.direction.split('+')
          nextPos = getNeighborPos(current, dir1)
        } else {
          nextPos = getNeighborPos(current, current.direction)
        }
        current = getTileAt(tiles, nextPos.x, nextPos.y)
      } else {
        break
      }
    }

    return path
  }, [tiles, getTileAt, getNeighborPos])

  const handleTileHover = (tile) => {
    const path = calculatePath(tile)
    setHighlightedPath(path)
  }

  const handleTileLeave = () => {
    setHighlightedPath([])
  }

  // Simulate one tick of distributed computation
  const simulateTick = useCallback(() => {
    tickRef.current += 1

    setTiles(prevTiles => {
      return prevTiles.map(tile => {
        if (tile.isExit) {
          return { ...tile, distance: 0, direction: null, directionEmoji: null }
        }

        const neighborDistances = { ...tile.neighborDistances }
        const directions = getDirections()

        // Poll each neighbor
        Object.keys(directions).forEach(dir => {
          const pos = getNeighborPos(tile, dir)
          const neighbor = getTileAt(prevTiles, pos.x, pos.y)
          neighborDistances[dir] = neighbor ? neighbor.distance : INFINITY
        })

        const minDistance = Math.min(...Object.values(neighborDistances))

        if (minDistance >= INFINITY) {
          return { ...tile, neighborDistances, distance: INFINITY, direction: null, directionEmoji: null }
        }

        const newDistance = minDistance + 1

        if (newDistance !== tile.distance || tile.direction === null) {
          const { direction, emoji } = getDisplayDirection(neighborDistances, minDistance)
          return {
            ...tile,
            neighborDistances,
            distance: newDistance,
            direction,
            directionEmoji: emoji,
          }
        }

        return { ...tile, neighborDistances }
      })
    })
  }, [getTileAt, getNeighborPos, getDirections, getDisplayDirection])

  const hasExits = tiles.some(t => t.isExit)

  useEffect(() => {
    if (!hasExits) {
      setIsRunning(false)
      setTiles(prev => prev.map(t => ({
        ...t,
        distance: INFINITY,
        direction: null,
        directionEmoji: null,
        neighborDistances: getEmptyNeighborDistances()
      })))
      return
    }

    setIsRunning(true)
    const interval = setInterval(simulateTick, TICK_INTERVAL)
    return () => clearInterval(interval)
  }, [hasExits, simulateTick, getEmptyNeighborDistances])

  const handleTileClick = (tileId) => {
    setTiles(prev => prev.map(t => {
      if (t.id === tileId) {
        const newIsExit = !t.isExit
        return {
          ...t,
          isExit: newIsExit,
          distance: newIsExit ? 0 : INFINITY,
          direction: null,
          directionEmoji: null,
          neighborDistances: getEmptyNeighborDistances()
        }
      }
      return t
    }))
    tickRef.current = 0
  }

  const getTileDisplay = (tile) => {
    if (tile.isExit) return EXIT_EMOJI
    if (!tile.direction) return ''
    return tile.directionEmoji || ''
  }

  const getPathPosition = (tileId) => {
    const index = highlightedPath.indexOf(tileId)
    if (index === -1) return -1
    return index / (highlightedPath.length - 1 || 1)
  }

  return (
    <div className="app">
      <header>
        <h1>🏭 IoT Floor Tile Simulator</h1>
        <p className="subtitle">Click tiles to mark exits • Hover to see path</p>
      </header>

      <div className="controls">
        <label>
          <span>Rows</span>
          <input
            type="number"
            min="2"
            max="20"
            value={rows}
            onChange={(e) => setRows(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
          />
        </label>
        <label>
          <span>Columns</span>
          <input
            type="number"
            min="2"
            max="20"
            value={cols}
            onChange={(e) => setCols(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
          />
        </label>
        <button className="reset-btn" onClick={initializeGrid}>
          Reset
        </button>
      </div>

      <div className="toggles">
        <label className="toggle">
          <input
            type="checkbox"
            checked={isHexGrid}
            onChange={(e) => setIsHexGrid(e.target.checked)}
          />
          <span>Hexagonal Grid</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={allowDiagonals}
            onChange={(e) => setAllowDiagonals(e.target.checked)}
            disabled={isHexGrid}
          />
          <span>Diagonal Arrows {isHexGrid && '(N/A for hex)'}</span>
        </label>
      </div>

      <div className="status">
        {!hasExits && <span className="hint">👆 Click any tile to designate it as an exit</span>}
        {isRunning && <span className="running">⚡ Distributed pathfinding active</span>}
      </div>

      <div
        className={`floor ${isHexGrid ? 'floor--hex' : 'floor--square'}`}
        style={{
          '--cols': cols,
          '--rows': rows,
        }}
      >
        {tiles.map(tile => {
          const pathPos = getPathPosition(tile.id)
          const inPath = pathPos >= 0

          return (
            <span
              key={tile.id}
              className={`floor-tile ${tile.isExit ? 'floor-tile--exit' : ''} ${tile.direction ? 'floor-tile--has-direction' : ''} ${inPath ? 'floor-tile--in-path' : ''}`}
              style={{
                '--path-pos': pathPos,
                '--col': tile.x,
                '--row': tile.y,
                '--is-odd-row': tile.y % 2,
              }}
              onClick={() => handleTileClick(tile.id)}
              onMouseEnter={() => handleTileHover(tile)}
              onMouseLeave={handleTileLeave}
              title={`(${tile.x}, ${tile.y}) - Distance: ${tile.distance === INFINITY ? '?' : tile.distance}`}
            >
              {getTileDisplay(tile)}
            </span>
          )
        })}
      </div>

      <footer>
        <p>
          Each tile simulates a microcontroller that only knows its {isHexGrid ? '6' : '4'} neighbors.
          <br />
          Watch the wave propagate as distance information spreads from exits!
        </p>
      </footer>
    </div>
  )
}

export default App