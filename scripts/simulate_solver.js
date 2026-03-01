const GRID_SIZE = 400; 
const LOCKED_RATIO = 0.15;
const USED_RATIO = 0.5;

function generateInitialSectors() {
  const sectors = Array(GRID_SIZE).fill(null).map((_, i) => ({ id: `slot-${i}`, type: 'empty' }));
  let lockedCount = Math.floor(GRID_SIZE * LOCKED_RATIO);
  while (lockedCount > 0) {
    const idx = Math.floor(Math.random() * GRID_SIZE);
    if (sectors[idx].type === 'empty') { sectors[idx].type = 'locked'; lockedCount--; }
  }
  let usedCount = 0;
  const targetUsed = Math.floor(GRID_SIZE * USED_RATIO);
  let fileCounter = 0;
  while (usedCount < targetUsed) {
    const fileSize = Math.floor(Math.random() * 4) + 1;
    const startIdx = Math.floor(Math.random() * (GRID_SIZE - fileSize));
    let canPlace = true;
    for (let i = 0; i < fileSize; i++) { if (sectors[startIdx + i].type !== 'empty') { canPlace = false; break; } }
    if (canPlace) {
      const fileId = `file-${fileCounter++}`;
      for (let i = 0; i < fileSize; i++) { sectors[startIdx + i].type = 'used'; sectors[startIdx + i].fileId = fileId; }
      usedCount += fileSize;
    }
    if (fileCounter > GRID_SIZE) break;
  }
  return sectors;
}

function canFit(sectors, size, targetIdx) {
  for (let j = 0; j < size; j++) {
    if (targetIdx + j >= sectors.length || sectors[targetIdx + j].type !== 'empty') return false;
  }
  return true;
}

function findNextMove(sectors) {
  const firstEmptyIdx = sectors.findIndex(s => s.type === 'empty');
  if (firstEmptyIdx === -1) return null;

  // Calculate size of the first gap
  let gapSize = 0;
  for (let i = firstEmptyIdx; i < sectors.length; i++) {
    if (sectors[i].type === 'empty') gapSize++;
    else break;
  }

  const allFiles = [];
  const seenFiles = new Set();
  // Start searching AFTER the gap
  for (let i = firstEmptyIdx + gapSize; i < sectors.length; i++) {
    const s = sectors[i];
    if (s.type === 'used' && s.fileId && !seenFiles.has(s.fileId)) {
      seenFiles.add(s.fileId);
      const fileSectors = sectors.filter(item => item.fileId === s.fileId);
      allFiles.push({ fileId: s.fileId, size: fileSectors.length, start: sectors.indexOf(fileSectors[0]) });
    }
  }

  // Strategy 1: Best Fit Fill
  // Find the largest file that fits into the current gap.
  // Prioritize files closer to the gap to minimize travel distance? No, prioritize size.
  let bestFit = null;
  for (const file of allFiles) {
    if (file.size <= gapSize) { // Fits in the gap
      if (!bestFit || file.size > bestFit.size) {
        bestFit = file;
      }
    }
  }

  if (bestFit) {
    return { fileId: bestFit.fileId, targetIdx: firstEmptyIdx };
  }

  // Strategy 2: If no file fits the gap (all files > gapSize), we must widen the gap.
  // Move the blocker (file immediately after gap) to the END.
  const blockerIdx = firstEmptyIdx + gapSize;
  const blocker = allFiles.find(f => f.start === blockerIdx);
  
  if (blocker) {
      for (let i = sectors.length - blocker.size; i > blocker.start; i--) {
          if (canFit(sectors, blocker.size, i)) return { fileId: blocker.fileId, targetIdx: i };
      }
  }

  return null;
}

function executeMove(sectors, fileId, targetIdx) {
  const newSectors = JSON.parse(JSON.stringify(sectors));
  newSectors.forEach((s, idx) => {
    if (s.fileId === fileId) { newSectors[idx].type = 'empty'; delete newSectors[idx].fileId; }
  });
  const size = sectors.filter(s => s.fileId === fileId).length;
  for (let i = 0; i < size; i++) { newSectors[targetIdx + i].type = 'used'; newSectors[targetIdx + i].fileId = fileId; }
  return newSectors;
}

function isWon(sectors) {
  let foundEmpty = false;
  for (const s of sectors) {
    if (s.type === 'empty') foundEmpty = true;
    else if (s.type === 'used' && foundEmpty) return false;
  }
  return true;
}

const NUM_TESTS = 100;
let successes = 0;
let failures = 0;

for (let t = 0; t < NUM_TESTS; t++) {
  let sectors = generateInitialSectors();
  let moves = 0;
  let stuck = false;
  const history = new Set();

  while (!isWon(sectors)) {
    const nextMove = findNextMove(sectors);
    if (!nextMove) { stuck = true; break; }
    sectors = executeMove(sectors, nextMove.fileId, nextMove.targetIdx);
    moves++;
    const hash = JSON.stringify(sectors);
    if (history.has(hash)) { console.log(`[Run ${t}] Loop at move ${moves}`); stuck = true; break; }
    history.add(hash);
    if (moves > 10000) { console.log(`[Run ${t}] Max moves`); stuck = true; break; }
  }
  if (stuck) failures++; else successes++;
}
console.log(`Results: ${successes} Successes, ${failures} Failures`);
