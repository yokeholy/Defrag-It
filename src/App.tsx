import { useState, useMemo } from 'react';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import './App.css';

type SectorType = 'empty' | 'used' | 'locked';

interface Sector {
  id: string;
  type: SectorType;
  fileId?: string;
}

const GRID_SIZE = 100;
const LOCKED_RATIO = 0.1;
const USED_RATIO = 0.4;

const generateInitialSectors = (): Sector[] => {
  const sectors: Sector[] = Array(GRID_SIZE).fill(null).map((_, i) => ({
    id: `slot-${i}`,
    type: 'empty'
  }));

  let lockedCount = Math.floor(GRID_SIZE * LOCKED_RATIO);
  while (lockedCount > 0) {
    const idx = Math.floor(Math.random() * GRID_SIZE);
    if (sectors[idx].type === 'empty') {
      sectors[idx].type = 'locked';
      lockedCount--;
    }
  }

  let usedCount = 0;
  const targetUsed = Math.floor(GRID_SIZE * USED_RATIO);
  let fileCounter = 0;

  while (usedCount < targetUsed) {
    const fileSize = Math.floor(Math.random() * 4) + 1;
    const startIdx = Math.floor(Math.random() * (GRID_SIZE - fileSize));
    
    let canPlace = true;
    for (let i = 0; i < fileSize; i++) {
      if (sectors[startIdx + i].type !== 'empty') {
        canPlace = false;
        break;
      }
    }

    if (canPlace) {
      const fileId = `file-${fileCounter++}`;
      for (let i = 0; i < fileSize; i++) {
        sectors[startIdx + i].type = 'used';
        sectors[startIdx + i].fileId = fileId;
      }
      usedCount += fileSize;
    }
    if (fileCounter > 100) break;
  }

  return sectors;
};

const SectorSlot = ({ 
  sector, 
  isDefragged, 
  isDragging, 
  isPotentialDrop,
  isFirst,
  isLast
}: { 
  sector: Sector; 
  isDefragged: boolean; 
  isDragging: boolean;
  isPotentialDrop: boolean;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const { setNodeRef: setDraggableRef, attributes, listeners } = useDraggable({
    id: sector.id,
    disabled: sector.type !== 'used',
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: sector.id,
    disabled: sector.type !== 'empty',
  });

  const typeClass = `sector-${sector.type}`;
  const defraggedClass = (sector.type === 'used' && isDefragged) ? 'defragged' : '';
  const overClass = (isOver || isPotentialDrop) ? 'drop-target' : '';
  
  const connectivityClass = sector.fileId ? `file-member ${isFirst ? 'file-start' : ''} ${isLast ? 'file-end' : ''}` : '';

  return (
    <div
      ref={(node) => {
        setDraggableRef(node);
        setDroppableRef(node);
      }}
      className={`sector ${typeClass} ${defraggedClass} ${overClass} ${connectivityClass}`}
      {...(sector.type === 'used' ? { ...attributes, ...listeners } : {})}
    />
  );
};

function App() {
  const [sectors, setSectors] = useState<Sector[]>(() => generateInitialSectors());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0); 
  const [isWon, setIsWon] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeFileData = useMemo(() => {
    if (!activeId) return null;
    const activeIdx = sectors.findIndex(s => s.id === activeId);
    const activeSector = sectors[activeIdx];
    if (!activeSector || !activeSector.fileId) return null;

    const fileSectors = sectors.filter(s => s.fileId === activeSector.fileId);
    
    return {
      fileId: activeSector.fileId,
      size: fileSectors.length,
    };
  }, [activeId, sectors]);

  const potentialDropIndices = useMemo(() => {
    if (!activeFileData || !overId) return new Set<number>();
    
    const targetIdx = sectors.findIndex(s => s.id === overId);
    const startIdx = targetIdx;
    const endIdx = startIdx + activeFileData.size - 1;

    if (startIdx < 0 || endIdx >= GRID_SIZE) return new Set<number>();

    for (let i = startIdx; i <= endIdx; i++) {
      if (sectors[i].type !== 'empty' && sectors[i].fileId !== activeFileData.fileId) {
        return new Set<number>();
      }
    }

    const indices = new Set<number>();
    for (let i = startIdx; i <= endIdx; i++) indices.add(i);
    return indices;
  }, [activeFileData, overId, sectors]);

  const defraggedIndices = useMemo(() => {
    const indices = new Set<number>();
    let foundEmpty = false;
    
    for (let i = 0; i < sectors.length; i++) {
      if (sectors[i].type === 'empty') {
        foundEmpty = true;
      } else if (sectors[i].type === 'used' && !foundEmpty) {
        indices.add(i);
      }
    }
    return indices;
  }, [sectors]);

  const checkWin = (currentSectors: Sector[]) => {
    let foundEmpty = false;
    for (const s of currentSectors) {
      if (s.type === 'empty') foundEmpty = true;
      else if (s.type === 'used' && foundEmpty) return false;
    }
    return true;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    
    const activeIdx = sectors.findIndex(s => s.id === id);
    const activeSector = sectors[activeIdx];
    const firstIdx = sectors.findIndex(s => s.fileId === activeSector.fileId);
    setDragOffset(activeIdx - firstIdx);
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { over } = event;
    setActiveId(null);
    setOverId(null);
    setDragOffset(0);

    if (over && activeFileData && potentialDropIndices.size > 0) {
      setSectors((prev) => {
        const newSectors = prev.map(s => ({ ...s }));
        const targetIdx = prev.findIndex(s => s.id === over.id);
        const newStartIdx = targetIdx;

        prev.forEach((s, idx) => {
          if (s.fileId === activeFileData.fileId) {
            newSectors[idx].type = 'empty';
            delete newSectors[idx].fileId;
          }
        });

        for (let i = 0; i < activeFileData.size; i++) {
          newSectors[newStartIdx + i].type = 'used';
          newSectors[newStartIdx + i].fileId = activeFileData.fileId;
        }

        if (checkWin(newSectors)) {
          setIsWon(true);
        }
        return newSectors;
      });
    }
  };

  const resetGame = () => {
    setSectors(generateInitialSectors());
    setIsWon(false);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="game-container">
        <header { ...{ style: { cursor: 'default' } } }>
          <h1>defragIt <small>v1.1</small></h1>
          <p>
            Drag <span className="text-used">multi-sector files</span>. The slot you hover becomes the file's <strong>head</strong>.
          </p>
        </header>
        
        <div className={`status ${isWon ? 'won' : ''}`}>
          {isWon ? 'DISK OPTIMIZED!' : 'Defragmentation in progress...'}
        </div>

        <div className="disk-grid">
          {sectors.map((sector, index) => {
            const isFirst = sector.fileId !== undefined && (index === 0 || sectors[index - 1].fileId !== sector.fileId);
            const isLast = sector.fileId !== undefined && (index === sectors.length - 1 || sectors[index + 1].fileId !== sector.fileId);
            
            return (
              <SectorSlot 
                key={sector.id} 
                sector={sector} 
                isDefragged={defraggedIndices.has(index)}
                isDragging={activeFileData?.fileId === sector.fileId}
                isPotentialDrop={potentialDropIndices.has(index)}
                isFirst={isFirst}
                isLast={isLast}
              />
            );
          })}
        </div>

        <button className="reset-btn" onClick={resetGame}>Reset Disk</button>
        
        <footer>
          <div className="legend">
            <div className="legend-item"><div className="sector sector-used defragged" /> Defragged</div>
            <div className="legend-item"><div className="sector sector-used" /> Fragmented</div>
            <div className="legend-item"><div className="sector sector-locked" /> Locked</div>
            <div className="legend-item"><div className="sector sector-empty" /> Free</div>
          </div>
        </footer>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeFileData ? (
          <div 
            style={{ 
              // Using margin instead of transform to avoid fighting dnd-kit's internal positioning
              marginLeft: `-${dragOffset * (42 + 6)}px`,
              pointerEvents: 'none'
            }}
          >
            <div className="file-dragging-overlay" style={{ display: 'flex' }}>
              {Array(activeFileData.size).fill(0).map((_, i) => (
                <div 
                  key={i} 
                  className={`sector sector-used ${i === 0 ? 'file-start' : ''} ${i === activeFileData.size - 1 ? 'file-end' : ''}`} 
                  style={{ opacity: 0.8 }} 
                />
              ))}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default App;
