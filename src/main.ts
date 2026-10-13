import './style.css'

type Direction = 'up' | 'down' | 'left' | 'right'
type Spot = { x: number; y: number; label: string; kind: 'window' | 'bed' | 'cafe' | 'toilet' | 'door' }
type SavedPhoto = { id: string; data: string; date: string }

const PHOTO_STORAGE_KEY = 'train-game-window-photos'
function loadSavedPhotos(): SavedPhoto[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PHOTO_STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((photo): photo is SavedPhoto =>
      photo && typeof photo.id === 'string' && typeof photo.data === 'string' && typeof photo.date === 'string') : []
  } catch { return [] }
}

const stations = [
  { name: 'Hà Nội', km: 0, time: '06:00' }, { name: 'Ninh Bình', km: 115, time: '08:12' },
  { name: 'Vinh', km: 319, time: '12:08' }, { name: 'Đồng Hới', km: 522, time: '17:20' },
  { name: 'Huế', km: 688, time: '22:10' }, { name: 'Đà Nẵng', km: 793, time: '01:25' },
  { name: 'Nha Trang', km: 1315, time: '12:48' }, { name: 'Biên Hòa', km: 1697, time: '20:58' },
  { name: 'Sài Gòn', km: 1726, time: '21:35' },
]
const stationMapPoints = [
  { x: 572, y: 236 }, { x: 584, y: 307 }, { x: 588, y: 401 },
  { x: 694, y: 484 }, { x: 718, y: 506 }, { x: 760, y: 530 },
  { x: 884, y: 767 }, { x: 717, y: 840 }, { x: 669, y: 837 },
]
// Intermediate map coordinates keep the live marker on the curved railway between stops.
const stationMapRoutes = [
  [stationMapPoints[0], { x: 579, y: 269 }, { x: 589, y: 284 }, { x: 585, y: 307 }, stationMapPoints[1]],
  [stationMapPoints[1], { x: 585, y: 330 }, { x: 586, y: 360 }, { x: 587, y: 380 }, stationMapPoints[2]],
  [stationMapPoints[2], { x: 610, y: 418 }, { x: 636, y: 438 }, { x: 660, y: 456 }, stationMapPoints[3]],
  [stationMapPoints[3], { x: 700, y: 487 }, { x: 709, y: 495 }, stationMapPoints[4]],
  [stationMapPoints[4], { x: 731, y: 511 }, { x: 746, y: 519 }, stationMapPoints[5]],
  [stationMapPoints[5], { x: 762, y: 528 }, { x: 778, y: 540 }, { x: 795, y: 553 }, { x: 838, y: 581 }, { x: 838, y: 605 }, { x: 838, y: 633 }, { x: 848, y: 668 }, { x: 884, y: 698 }, { x: 884, y: 721 }, { x: 884, y: 745 }, stationMapPoints[6]],
  [stationMapPoints[6], { x: 884, y: 794 }, { x: 872, y: 812 }, { x: 852, y: 826 }, { x: 826, y: 834 }, { x: 790, y: 844 }, { x: 760, y: 840 }, { x: 735, y: 840 }, stationMapPoints[7]],
  [stationMapPoints[7], { x: 690, y: 840 }, { x: 678, y: 840 }, stationMapPoints[8]],
]
const spots: Spot[] = [
  { x: 207, y: 400, label: 'Rest in your berth', kind: 'bed' },
  { x: 335, y: 400, label: 'Look out the window', kind: 'window' },
  { x: 520, y: 400, label: 'Look out the window', kind: 'window' },
  { x: 719, y: 400, label: 'Cafeteria · Phở & tea', kind: 'cafe' },
  { x: 1080, y: 400, label: 'Toilet', kind: 'toilet' },
  { x: 1392, y: 400, label: 'Look out the window', kind: 'window' },
  { x: 1510, y: 400, label: 'Look out the window', kind: 'window' },
  { x: 1690, y: 400, label: 'Look out the window', kind: 'window' },
  { x: 1900, y: 400, label: 'Look out the window', kind: 'window' },
]
const game = {
  x: 207, trainX: 207, y: 438, facing: 'down' as Direction, walk: 0, moving: false,
  keys: new Set<string>(), station: 0, distance: 0, day: 1, tick: 0, clockMinutes: 6 * 60,
  energy: 82, appetite: 72, thirst: 64, autoDepart: false, orderOpen: false, cameraOpen: false, photos: loadSavedPhotos(),
  message: 'You are at Hà Nội station. Take a walk before departure.',
  toast: '', toastUntil: 0, activity: '', phase: 'stopped' as 'moving' | 'stopped' | 'arrived', stopFrames: 0,
}
const canvas = document.querySelector<HTMLCanvasElement>('#world')!
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false
// Draw on a detailed native pixel grid so fine outlines and lettering stay crisp.
const W = canvas.width, H = canvas.height
const CARRIAGE_SOURCE_WIDTH = 800
const PASSENGER_SECTION_SOURCE_WIDTH = 1635
const trainImage = new Image()
trainImage.src = '/assets/trains/train_cutout.png'
const railwayImage = new Image()
railwayImage.src = '/assets/railways/railway_cutout.png'
const hanoiStationImage = new Image()
hanoiStationImage.src = '/assets/stations/hanoi_station.png'
const saigonStationImage = new Image()
saigonStationImage.src = '/assets/stations/saigon_station.png'
const treeImage = new Image()
treeImage.src = '/assets/scenery/tree_cutout.png'
const mountainImage = new Image()
let mountainCutout: HTMLCanvasElement | null = null
mountainImage.onload = prepareMountainCutout
mountainImage.src = '/assets/scenery/mountain.avif'
const characterImage = new Image()
characterImage.src = '/assets/characters/main_character_cutout.png'

function box(x: number, y: number, w: number, h: number, color: string) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)) }
function text(s: string, x: number, y: number, color = '#fff2c5', size = 6, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = align; ctx.fillText(s, x, y)
}
function distance(s: Spot) { return Math.hypot(s.x - game.x, s.y - game.y) }
function activeSpot() {
  const toilet = spots.find(s => s.kind === 'toilet')
  if (toilet && game.phase === 'moving' && Math.abs(game.x - toilet.x) <= 220) return toilet
  const cafe = spots.find(s => s.kind === 'cafe')
  if (cafe && game.phase === 'moving' && Math.abs(game.x - cafe.x) <= 150) return cafe
  const window = spots.filter(s => s.kind === 'window')
    .sort((a, b) => Math.abs(a.x - game.x) - Math.abs(b.x - game.x))
    .find(s => Math.abs(s.x - game.x) <= 70)
  if (window && game.phase === 'moving') return window
  const nearest = [...spots].filter(s => s.kind !== 'window').sort((a, b) => distance(a) - distance(b))[0]
  return nearest && distance(nearest) < 42 ? nearest : undefined
}
function trainWorldWidth() {
  return trainImage.naturalWidth ? trainImage.naturalWidth * W / CARRIAGE_SOURCE_WIDTH : W
}
function passengerSectionWidth() {
  return PASSENGER_SECTION_SOURCE_WIDTH * W / CARRIAGE_SOURCE_WIDTH
}
function trainCameraOffset(position = game.x) {
  return Math.max(0, Math.min(position - W / 2, trainWorldWidth() - W))
}
function mapPosition(km: number) {
  let leg = 0
  while (leg < stations.length - 2 && km > stations[leg + 1].km) leg++
  const start = stations[leg].km, end = stations[leg + 1].km
  const progress = Math.max(0, Math.min(1, (km - start) / (end - start)))
  const route = stationMapRoutes[leg]
  const lengths = route.slice(1).map((point, index) => Math.hypot(point.x - route[index].x, point.y - route[index].y))
  const totalLength = lengths.reduce((total, length) => total + length, 0)
  let remaining = progress * totalLength
  for (let index = 0; index < lengths.length; index++) {
    const start = route[index], end = route[index + 1], length = lengths[index]
    if (remaining <= length || index === lengths.length - 1) {
      const segmentProgress = length ? remaining / length : 0
      return { x: start.x + (end.x - start.x) * segmentProgress, y: start.y + (end.y - start.y) * segmentProgress }
    }
    remaining -= length
  }
  return route[route.length - 1]
}
function prepareMountainCutout() {
  const width = mountainImage.naturalWidth, height = mountainImage.naturalHeight
  if (!width || !height) return
  const source = document.createElement('canvas'); source.width = width; source.height = height
  const sourceContext = source.getContext('2d', { willReadFrequently: true })!
  sourceContext.drawImage(mountainImage, 0, 0)
  const image = sourceContext.getImageData(0, 0, width, height), pixels = image.data
  const references: number[][] = []
  for (const [x0, y0] of [[0, 0], [width - 8, 0], [0, height - 8], [width - 8, height - 8]]) {
    let r = 0, g = 0, b = 0, count = 0
    for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) {
      const i = (y * width + x) * 4; r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++
    }
    references.push([r / count, g / count, b / count])
  }
  const matchesBackground = (pixel: number) => references.some(([r, g, b]) => {
    const dr = pixels[pixel] - r, dg = pixels[pixel + 1] - g, db = pixels[pixel + 2] - b
    return dr * dr + dg * dg + db * db < 38 * 38
  })
  const total = width * height, queue = new Uint32Array(total); let head = 0, tail = 0
  const enqueue = (index: number) => {
    const pixel = index * 4
    if (pixels[pixel + 3] && matchesBackground(pixel)) {
      pixels[pixel + 3] = 0; queue[tail++] = index
    }
  }
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1) }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width)
    if (x) enqueue(index - 1)
    if (x + 1 < width) enqueue(index + 1)
    if (y) enqueue(index - width)
    if (y + 1 < height) enqueue(index + width)
  }
  let left = width, top = height, right = 0, bottom = 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1) }
  }
  if (right <= left || bottom <= top) return
  mountainCutout = document.createElement('canvas'); mountainCutout.width = right - left; mountainCutout.height = bottom - top
  mountainCutout.getContext('2d')!.putImageData(image, -left, -top)
}
function palette() {
  const hour = game.clockMinutes / 60 % 24
  if (hour < 5.5 || hour >= 20) return { sky: ['#101b35','#172744','#1c3150','#213a57'], far: '#536d83', mid: '#405e6e', near: '#293d4c', land: '#344c44', sun: '#e7e2c8', night: true }
  if ((hour >= 5.5 && hour < 7.5) || (hour >= 17 && hour < 20)) return { sky: ['#536995','#7e83a3','#bd8b9c','#e2ae83'], far: '#8296a1', mid: '#5d7e7d', near: '#3e645d', land: '#6b7654', sun: '#f3d79a', night: false }
  return { sky: ['#63a8ed','#79b6ed','#a2cfee','#c6e1d2'], far: '#9cb6bd', mid: '#527b85', near: '#315a59', land: '#718b50', sun: '#fff0b1', night: false }
}
function peak(cx: number, base: number, width: number, height: number, color: string, shade: string, snow = false) {
  for (let y = 0; y <= height; y += 3) {
    const half = Math.max(2, Math.floor((y / height) * width / 2))
    const py = base - height + y
    box(cx - half, py, half, 3, color); box(cx, py, half, 3, shade)
    if (snow && y < height * .23) { const capHalf = Math.max(2, Math.floor(half * .5)); box(cx - capHalf, py, capHalf, 3, '#d4e2d9'); box(cx, py, capHalf, 3, '#b2ccd0') }
  }
}
function mountainScenery(cx: number, base: number, maxWidth: number, maxHeight: number, color: string, shade: string) {
  if (mountainCutout) {
    const scale = Math.min(maxWidth / mountainCutout.width, maxHeight / mountainCutout.height)
    const width = mountainCutout.width * scale, height = mountainCutout.height * scale
    ctx.drawImage(mountainCutout, cx - width / 2, base - height, width, height)
  } else peak(cx, base, maxWidth, maxHeight, color, shade, true)
}
function pine(x: number, base: number, h: number, c: string, hi: string) {
  box(x - 2, base - h, 4, h, '#263746')
  for (let row = 0; row < 5; row++) {
    const y = base - h + row * Math.floor(h / 5), half = Math.floor((row + 1) * h / 13)
    box(x - half - 2, y, half * 2 + 4, Math.max(4, Math.floor(h / 4)), '#263746')
    box(x - half, y + 2, half, Math.max(2, Math.floor(h / 5)), row % 2 ? c : hi)
    box(x + 1, y + 2, half, Math.max(2, Math.floor(h / 5)), c)
    box(x - half + 3, y + 3, Math.max(2, Math.floor(half / 2)), 2, hi)
  }
}
function sceneryTree(centerX: number, base: number, height: number, fallback: { color: string; highlight: string }) {
  if (treeImage.complete && treeImage.naturalWidth) {
    const width = height * treeImage.naturalWidth / treeImage.naturalHeight
    ctx.drawImage(treeImage, centerX - width / 2, base - height, width, height)
  } else pine(centerX, base, height, fallback.color, fallback.highlight)
}
function cloud(x: number, y: number, scale: number, color: string) {
  box(x + 8 * scale, y, 16 * scale, 4 * scale, color); box(x + 3 * scale, y + 4 * scale, 30 * scale, 5 * scale, color); box(x, y + 8 * scale, 38 * scale, 5 * scale, color); box(x + 8 * scale, y + 13 * scale, 21 * scale, 3 * scale, color)
  box(x + 9 * scale, y - 2 * scale, 8 * scale, 3 * scale, '#ffffff55')
}
function drawStationBuildings(p: ReturnType<typeof palette>) {
  const farColors = p.night ? ['#38465a', '#455365', '#514858', '#3b5360'] : ['#b98d70', '#cbaa83', '#81949a', '#ae7968']
  const nearColors = p.night ? ['#4a4b59', '#3e5361', '#65505a', '#465d5c'] : ['#d0aa80', '#8c9c91', '#b7836c', '#9aa28a']
  const drawRow = (base: number, minHeight: number, heightRange: number, minWidth: number, widthRange: number, colors: string[], seed: number) => {
    let x = -18, index = 0
    while (x < W + 20) {
      const width = minWidth + (index * 31 + seed * 13) % widthRange
      const height = minHeight + (index * 43 + seed * 17) % heightRange
      const top = base - height
      box(x - 2, top - 3, width + 4, height + 3, p.night ? '#263344' : '#596773')
      box(x, top, width, height, colors[(index + seed) % colors.length])
      box(x - 2, top - 3, width + 4, 4, p.night ? '#68717b' : '#d2c2a0')
      if (index % 3 === 1) { box(x + width / 2 - 2, top - 9, 4, 6, p.night ? '#555b68' : '#8c8f83'); box(x + width / 2 - 1, top - 13, 2, 4, p.night ? '#e5b978' : '#a35f4e') }
      for (let wy = top + 9; wy < base - 8; wy += 12) for (let wx = x + 7; wx < x + width - 5; wx += 11) {
        box(wx, wy, 5, 6, p.night ? '#e6bd78' : '#536875')
        if (!p.night) box(wx + 1, wy + 1, 3, 4, '#d9d0ae')
      }
      x += width + 9; index++
    }
  }
  drawRow(250, 40, 48, 36, 39, farColors, game.station + 2)
  drawRow(263, 23, 38, 29, 34, nearColors, game.station + 7)
}
function drawSkyAndMountains() {
  const p = palette(), scroll = game.phase === 'moving' ? game.distance * .48 : game.distance * .48
  for (let y = 0; y < 245; y += 24) box(0, y, W, 24, p.sky[Math.min(3, Math.floor(y / 64))])
  if (p.night) {
    for (let i = 0; i < 72; i++) { const x = (i * 113 + 37) % W, y = (i * 47 + 13) % 205; box(x, y, i % 8 === 0 ? 3 : 2, i % 8 === 0 ? 3 : 2, i % 3 ? '#d5e1db' : '#9db4c8') }
    const hour = game.clockMinutes / 60 % 24, moonPath = hour >= 20 ? (hour - 20) / 9.5 : (hour + 4) / 9.5, moonX = 100 + moonPath * 540
    box(moonX - 20, 57, 42, 42, '#d8d9c3'); box(moonX - 14, 51, 30, 6, '#d8d9c3'); box(moonX - 26, 65, 6, 25, '#d8d9c3'); box(moonX + 15, 62, 5, 17, '#a9b2aa')
  } else {
    const hour = game.clockMinutes / 60 % 24, sunProgress = Math.max(0, Math.min(1, (hour - 6) / 12)), sunX = 110 + sunProgress * 530
    box(sunX - 20, 57, 42, 42, p.sun); box(sunX - 14, 51, 30, 6, p.sun); box(sunX - 26, 65, 6, 26, p.sun)
    const drift = Math.floor(scroll * .13) % 900
    cloud((78 - drift + 900) % 900 - 38, 75, 1, '#e8f3ec'); cloud((464 - drift + 900) % 900 - 38, 122, 1, '#d7e8e6')
  }
  if (game.phase !== 'moving') {
    drawStationBuildings(p)
    return
  }
  const drift = Math.floor(scroll) % 900
  for (let i = -1; i < 4; i++) {
    const x = i * 290 - drift
    mountainScenery(x + 122, 255, 250, 166, p.far, p.mid)
    mountainScenery(x + 274, 261, 218, 127, p.far, p.mid)
  }
  // Distance-layered tree rows form a continuous moving valley.
  const farShift = Math.floor(scroll * .48) % 82
  for (let i = -1; i < 12; i++) sceneryTree(i * 78 - farShift, 270, 48 + (i * 17 % 19), { color: p.mid, highlight: p.far })
  const nearShift = Math.floor(scroll * .88) % 68
  for (let i = -1; i < 14; i++) sceneryTree(i * 62 - nearShift, 289, 56 + (i * 11 % 21), { color: p.near, highlight: p.mid })
  box(0, 277, W, 52, p.land)
  for (let i = -1; i < 14; i++) {
    const x = i * 64 - Math.floor(scroll * 1.3) % 64
    box(x, 279 + i % 3 * 6, 36, 4, i % 2 ? '#82955b' : '#8c9b5c'); box(x + 9, 294 + i % 4 * 5, 24, 3, '#b2a86e'); box(x + 3, 310 + i % 2 * 7, 3, 2, '#d8d092')
  }
}
function drawStationBackdrop() {
  const p = palette()
  // Keep the same valley, platform and road scene at every stop.
  box(0, 241, W, 102, p.night ? '#3b4659' : '#9da27b')
  const stationImage = game.station === 0 ? hanoiStationImage : game.station === stations.length - 1 ? saigonStationImage : undefined
  if (stationImage?.complete && stationImage.naturalWidth) {
    const width = W * .7, height = width * stationImage.naturalHeight / stationImage.naturalWidth
    // Station PNGs are building cutouts; align each base with the shared platform.
    ctx.drawImage(stationImage, (W - width) / 2, 270 - height * .91, width, height)
  } else {
    box(66, 184, 264, 88, '#252e42'); box(72, 190, 252, 78, '#484d62')
    box(77, 194, 242, 20, '#34465c')
    for (let x = 80; x < 316; x += 16) { box(x, 196, 14, 15, '#4d7790'); box(x + 2, 198, 10, 10, '#81adba'); box(x + 3, 199, 6, 3, '#c1d5c9') }
    box(68, 213, 260, 5, '#232d42'); box(61, 218, 276, 7, '#ae715b')
    for (const x of [79, 153, 227, 301]) { box(x, 225, 8, 48, '#252d40'); box(x + 2, 227, 4, 43, '#b18e6f'); box(x + 3, 229, 2, 37, '#d4b489') }
    box(101, 228, 46, 36, '#303a50'); box(105, 232, 38, 28, '#715247'); box(108, 235, 32, 22, '#b38962'); box(111, 238, 26, 5, '#39475a')
    box(177, 231, 83, 31, '#30394d'); box(181, 235, 75, 23, '#d5c29c'); text(stations[game.station].name.toLocaleUpperCase('vi'), 218, 251, '#394457', 11, 'center')
  }
  box(0, 270, W, H - 270, p.night ? '#56515a' : '#8a8174')
  box(0, 270, W, 7, p.night ? '#a9a08b' : '#d0b98b')
  box(0, 277, W, 4, p.night ? '#716b6d' : '#a69a82')
  for (let x = 18; x < W; x += 74) {
    box(x, 302, 30, 3, p.night ? '#6d6670' : '#9a9080')
    box(x + 38, 331, 22, 3, p.night ? '#6d6670' : '#9a9080')
  }
}
function drawTrack() {
  const p = palette(), scroll = (game.distance * 2.1) % W
  box(0, 462, W, 50, p.night ? '#302e3d' : '#665449')
  if (railwayImage.complete && railwayImage.naturalWidth) {
    const width = W, height = width * railwayImage.naturalHeight / railwayImage.naturalWidth
    // The lower rail in the sprite should meet the train's wheel baseline.
    ctx.drawImage(railwayImage, -scroll, 397, width, height)
    ctx.drawImage(railwayImage, width - scroll, 397, width, height)
  }
}
function drawTrain() {
  if (trainImage.complete && trainImage.naturalWidth) {
    const width = trainWorldWidth(), scale = width / trainImage.naturalWidth
    const height = trainImage.naturalHeight * scale
    const wheelLine = 468
    ctx.drawImage(trainImage, -trainCameraOffset(), wheelLine - height, width, height)
  }
}
function drawPlayer() {
  const bob = game.moving ? Math.floor(game.walk / 5) % 2 : 0
  const x = Math.round(game.phase === 'moving' ? game.x - trainCameraOffset() : game.x), y = Math.round(game.y + bob)
  box(x - 9, y + 11, 18, 4, '#29304455')
  if (characterImage.complete && characterImage.naturalWidth) {
    ctx.drawImage(characterImage, x - 11, y - 18, 22, 29)
  }
}
function drawWorld() {
  game.tick++
  drawSkyAndMountains()
  if (game.phase !== 'moving') drawStationBackdrop()
  if (game.phase === 'moving') { drawTrack(); drawTrain() }
  if (game.phase === 'stopped') {
    box(13, 14, 185, 25, '#222c43'); box(16, 17, 179, 19, '#36445d')
    text(`STOPPED AT ${stations[game.station].name.toLocaleUpperCase('vi')}`, 24, 30, '#fff0bf', 10)
  } else if (game.phase === 'arrived') {
    box(13, 14, 182, 25, '#222c43'); box(16, 17, 176, 19, '#4a594d'); text('END OF THE LINE · SÀI GÒN', 24, 30, '#fff0bf', 9)
  }
  drawPlayer()
  const near = game.phase === 'moving' ? activeSpot() : undefined
  if (near) {
    const width = near.label.length * 7 + 34
    const screenX = near.x - trainCameraOffset()
    const x = Math.max(4, Math.min(W - width - 4, screenX - width / 2))
    const trainTop = 468 - (trainImage.naturalWidth ? trainImage.naturalHeight * trainWorldWidth() / trainImage.naturalWidth : 173)
    const promptY = Math.max(24, trainTop - 3)
    box(x, promptY, width, 22, '#192338'); box(x + 2, promptY + 2, width - 4, 18, '#34425a')
    text('E  ' + near.label, x + 8, promptY + 14, '#fff0c5', 10)
  }
}
type CameraMode = 'station' | 'window' | 'selfie' | 'toilet'
function cameraMode(): CameraMode {
  if (game.phase !== 'moving') return 'station'
  const toilet = spots.find(s => s.kind === 'toilet')!
  if (Math.abs(game.x - toilet.x) <= 220) return 'toilet'
  const cafe = spots.find(s => s.kind === 'cafe')!
  if (Math.abs(game.x - cafe.x) <= 150) return 'selfie'
  return 'window'
}
function refreshCameraView(): string | undefined {
  const preview = document.querySelector<HTMLImageElement>('#sight-photo')
  if (!preview) return undefined
  const photo = document.createElement('canvas'); photo.width = 320; photo.height = 240
  const photoContext = photo.getContext('2d')!
  const mode = cameraMode()
  if (mode === 'station') {
    photoContext.drawImage(canvas, (W - H * 4 / 3) / 2, 0, H * 4 / 3, H, 0, 0, photo.width, photo.height)
  } else if (mode === 'window') {
    const viewWidth = 360
    const screenX = game.x - trainCameraOffset()
    const viewX = Math.max(0, Math.min(W - viewWidth, screenX - viewWidth / 2))
    photoContext.drawImage(canvas, viewX, 0, viewWidth, 270, 0, 0, photo.width, photo.height)
  } else if (mode === 'toilet') {
    photoContext.filter = 'blur(12px)'
    photoContext.drawImage(canvas, 0, 0, W, H, -10, -8, photo.width + 20, photo.height + 16)
    photoContext.filter = 'none'
  } else {
    const backdrop = photoContext.createLinearGradient(0, 0, 0, photo.height)
    backdrop.addColorStop(0, '#9ab9b1'); backdrop.addColorStop(1, '#e4c79e')
    photoContext.fillStyle = backdrop; photoContext.fillRect(0, 0, photo.width, photo.height)
    for (let i = 0; i < 8; i++) {
      photoContext.fillStyle = i % 2 ? '#718a78' : '#80927d'
      photoContext.fillRect(i * 46 - 8, 28 + i % 3 * 13, 34, 5)
    }
    if (characterImage.complete && characterImage.naturalWidth) photoContext.drawImage(characterImage, 108, 54, 104, 138)
    else { photoContext.fillStyle = '#263b35'; photoContext.fillRect(125, 75, 70, 125); photoContext.fillStyle = '#e7bd91'; photoContext.fillRect(139, 82, 42, 42) }
    photoContext.strokeStyle = '#fff2c5'; photoContext.lineWidth = 3; photoContext.strokeRect(7, 7, photo.width - 14, photo.height - 14)
  }
  const data = photo.toDataURL('image/jpeg', 0.78)
  preview.src = data
  return data
}
function openPhoneCamera() {
  game.cameraOpen = true; game.orderOpen = false
  const phone = document.querySelector('.phone-screen')!
  phone.classList.remove('ordering'); phone.classList.add('camera-active')
  const captions: Record<CameraMode, string> = {
    station: `Station view · ${stations[game.station].name}`,
    window: 'Window view · passing scenery',
    selfie: 'Selfie mode · no windows in this carriage',
    toilet: 'Privacy mode · camera view is blurred here',
  }
  document.querySelector('#camera-caption')!.textContent = captions[cameraMode()]
  refreshCameraView()
}
function persistPhotos() {
  try { localStorage.setItem(PHOTO_STORAGE_KEY, JSON.stringify(game.photos)); return true }
  catch { return false }
}
function renderGallery() {
  const gallery = document.querySelector<HTMLDivElement>('#photo-gallery')!
  const empty = document.querySelector<HTMLParagraphElement>('#gallery-empty')!
  document.querySelector('#gallery-count')!.textContent = `${game.photos.length} ${game.photos.length === 1 ? 'photo' : 'photos'}`
  empty.hidden = game.photos.length > 0
  gallery.replaceChildren()
  for (const photo of [...game.photos].reverse()) {
    const card = document.createElement('article'); card.className = 'saved-photo'
    const image = document.createElement('img'); image.src = photo.data; image.alt = `Train window photo taken ${photo.date}`
    const footer = document.createElement('div'); footer.className = 'saved-photo-footer'
    const date = document.createElement('small'); date.textContent = photo.date
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-photo'; remove.dataset.deletePhoto = photo.id; remove.setAttribute('aria-label', 'Delete photo'); remove.textContent = 'Delete'
    footer.append(date, remove); card.append(image, footer); gallery.append(card)
  }
}
function interaction(spot = activeSpot()) {
  if (game.phase !== 'moving') return
  if (!spot || (!['toilet', 'cafe', 'window'].includes(spot.kind) && distance(spot) > 36)) { game.message = 'Walk closer to a train feature and press E to interact.'; notify(game.message); return }
  if (spot.kind === 'bed') { game.energy = Math.min(100, game.energy + 28); game.message = 'You stretch out in your sleeper berth and take a quick nap.'; game.activity = 'Rested in the sleeper car' }
  else if (spot.kind === 'window') {
    openPhoneCamera()
    game.message = 'You take in the view from the window. The scenery is ready on your phone camera.'
    game.activity = 'Sightseeing from the train window'
    updateHud(); notify(game.message); return
  }
  else if (spot.kind === 'cafe') {
    game.orderOpen = true
    game.cameraOpen = false
    document.querySelector('.phone-screen')!.classList.remove('camera-active')
    document.querySelector('.phone-screen')!.classList.add('ordering')
    game.message = 'Choose something from the cafeteria menu on your phone.'
    game.activity = 'Ordering at the cafeteria counter'
    updateHud(); notify(game.message); return
  }
  else if (spot.kind === 'toilet') { game.message = 'You freshen up in the little onboard toilet.'; game.activity = 'Visited the toilet' }
  else { game.message = 'All aboard! You climb into the waiting SE 1 sleeper carriage.'; game.activity = 'Boarded the train' }
  notify(game.message); updateHud()
}
function notify(message: string) {
  game.toast = message; game.toastUntil = performance.now() + 2500
  const el = document.querySelector<HTMLElement>('#toast')!; el.textContent = message; el.classList.add('visible'); window.setTimeout(() => el.classList.remove('visible'), 2500)
}
function updateHud() {
  const current = stations[game.station], next = stations[Math.min(game.station + 1, stations.length - 1)]
  document.querySelector('#map-current')!.textContent = current.name
  document.querySelector('#map-next')!.textContent = next.name
  const hour = Math.floor(game.clockMinutes / 60) % 24, minute = Math.floor(game.clockMinutes % 60)
  game.day = Math.floor(game.clockMinutes / 1440) + 1
  document.querySelector('#clock')!.textContent = `DAY ${game.day} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  document.querySelector('#activity')!.textContent = game.phase === 'stopped'
    ? game.message
    : game.phase === 'arrived' ? game.message : game.activity || game.message
  for (const key of ['energy', 'appetite', 'thirst'] as const) { document.querySelector<HTMLElement>(`#${key}-bar`)!.style.width = `${game[key]}%`; document.querySelector<HTMLElement>(`#${key}-value`)!.textContent = `${game[key]}%` }
  document.querySelector('#map-km')!.textContent = `${Math.floor(game.distance).toLocaleString()} km`
  document.querySelector<HTMLElement>('#map-progress')!.style.width = `${game.distance / 1726 * 100}%`
  const marker = mapPosition(game.distance)
  for (const id of ['#train-map-marker', '#train-map-center']) {
    const element = document.querySelector<SVGCircleElement>(id)!
    element.setAttribute('cx', String(marker.x)); element.setAttribute('cy', String(marker.y))
  }
  document.querySelector('#stop-count')!.textContent = `${game.station + 1} / ${stations.length}`
  const advance = document.querySelector<HTMLButtonElement>('#advance')!
  const advanceLabel = game.phase === 'stopped' ? 'Depart station' : game.phase === 'arrived' ? 'Journey complete' : 'Train is travelling'
  advance.setAttribute('aria-label', advanceLabel)
  advance.title = advanceLabel
  advance.disabled = game.phase === 'moving' || game.phase === 'arrived'
  const autoDepart = document.querySelector<HTMLButtonElement>('#auto-depart')!
  autoDepart.setAttribute('aria-checked', String(game.autoDepart))
  autoDepart.classList.toggle('enabled', game.autoDepart)
  document.querySelector('#auto-depart-status')!.textContent = game.autoDepart ? 'ON · departs after five seconds' : 'OFF · wait for user'
}
const routeMap = document.querySelector<HTMLElement>('.route-map')!
const mapZoomLayer = document.querySelector<HTMLElement>('.map-zoom-layer')!
let mapZoom = 4, mapPanX = 0, mapPanY = 0, initialMapView = true
const activePointers = new Map<number, { x: number; y: number }>()
let pinchStart: { distance: number; zoom: number; x: number; y: number } | undefined
function clampMapPan() {
  const bounds = routeMap.getBoundingClientRect()
  const limitX = bounds.width * (mapZoom - 1) / 2, limitY = bounds.height * (mapZoom - 1) / 2
  mapPanX = Math.max(-limitX, Math.min(limitX, mapPanX)); mapPanY = Math.max(-limitY, Math.min(limitY, mapPanY))
}
function renderMapZoom() {
  if (!routeMap.clientWidth || !routeMap.clientHeight) return
  if (initialMapView) {
    // Start on the northern route at the same close framing as the map preview.
    mapPanX = routeMap.clientWidth * (1.5 - mapZoom * 0.29)
    mapPanY = routeMap.clientHeight * (1.5 - mapZoom * 0.17)
    initialMapView = false
  }
  clampMapPan()
  const width = routeMap.clientWidth * mapZoom, height = routeMap.clientHeight * mapZoom
  mapZoomLayer.style.width = `${width}px`; mapZoomLayer.style.height = `${height}px`
  mapZoomLayer.style.left = `${(routeMap.clientWidth - width) / 2 + mapPanX}px`
  mapZoomLayer.style.top = `${(routeMap.clientHeight - height) / 2 + mapPanY}px`
  document.querySelector<HTMLButtonElement>('#map-zoom-out')!.disabled = mapZoom <= 1
  document.querySelector<HTMLButtonElement>('#map-zoom-in')!.disabled = mapZoom >= 4
  document.querySelector<HTMLButtonElement>('#map-zoom-reset')!.disabled = mapZoom === 1
}
const mapResizeObserver = new ResizeObserver(() => {
  if (routeMap.clientWidth && routeMap.clientHeight) renderMapZoom()
})
mapResizeObserver.observe(routeMap)
mapZoomLayer.querySelector('img')!.addEventListener('load', renderMapZoom)
function zoomMap(nextZoom: number, focalX = routeMap.clientWidth / 2, focalY = routeMap.clientHeight / 2) {
  const zoom = Math.max(1, Math.min(4, nextZoom)), ratio = zoom / mapZoom
  mapPanX = focalX - routeMap.clientWidth / 2 - (focalX - routeMap.clientWidth / 2 - mapPanX) * ratio
  mapPanY = focalY - routeMap.clientHeight / 2 - (focalY - routeMap.clientHeight / 2 - mapPanY) * ratio
  mapZoom = zoom; renderMapZoom()
}
document.querySelector('#map-zoom-in')!.addEventListener('click', () => zoomMap(mapZoom * 1.25))
document.querySelector('#map-zoom-out')!.addEventListener('click', () => zoomMap(mapZoom / 1.25))
document.querySelector('#map-zoom-reset')!.addEventListener('click', () => { mapZoom = 1; mapPanX = 0; mapPanY = 0; renderMapZoom() })
routeMap.addEventListener('wheel', event => {
  event.preventDefault()
  const bounds = routeMap.getBoundingClientRect()
  zoomMap(mapZoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX - bounds.left, event.clientY - bounds.top)
}, { passive: false })
routeMap.addEventListener('pointerdown', event => {
  if ((event.target as HTMLElement).closest('.map-zoom-controls')) return
  routeMap.setPointerCapture(event.pointerId)
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (activePointers.size === 2) {
    const [a, b] = [...activePointers.values()]
    pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: mapZoom,
      x: (a.x + b.x) / 2 - routeMap.getBoundingClientRect().left, y: (a.y + b.y) / 2 - routeMap.getBoundingClientRect().top }
  }
})
routeMap.addEventListener('pointermove', event => {
  const previous = activePointers.get(event.pointerId)
  if (!previous) return
  const point = { x: event.clientX, y: event.clientY }
  activePointers.set(event.pointerId, point)
  if (activePointers.size === 2 && pinchStart) {
    const [a, b] = [...activePointers.values()], bounds = routeMap.getBoundingClientRect()
    const focalX = (a.x + b.x) / 2 - bounds.left, focalY = (a.y + b.y) / 2 - bounds.top
    zoomMap(pinchStart.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.distance, focalX, focalY)
  } else if (mapZoom > 1) {
    mapPanX += point.x - previous.x; mapPanY += point.y - previous.y; renderMapZoom()
  }
})
function releaseMapPointer(event: PointerEvent) { activePointers.delete(event.pointerId); if (activePointers.size < 2) pinchStart = undefined }
routeMap.addEventListener('pointerup', releaseMapPointer)
routeMap.addEventListener('pointercancel', releaseMapPointer)
window.addEventListener('resize', renderMapZoom)
renderMapZoom()
function arriveAtNextStation() {
  if (game.station >= stations.length - 1) { game.phase = 'arrived'; game.message = 'You made it from Hà Nội all the way to Sài Gòn.'; updateHud(); notify(game.message); return }
  game.trainX = game.x
  game.x = Math.max(16, Math.min(W - 16, game.x - trainCameraOffset()))
  game.station++
  game.distance = stations[game.station].km
  game.phase = 'stopped'; game.stopFrames = 0
  game.appetite = Math.max(8, game.appetite - 8); game.thirst = Math.max(8, game.thirst - 6); game.energy = Math.max(20, game.energy - 3)
  game.message = `The train has arrived at ${stations[game.station].name}. Take a moment before departure.`
  game.activity = 'Stopped at the station platform'
  updateHud(); notify(game.message)
}
function resumeJourney() {
  if (game.phase !== 'stopped') return
  if (game.station >= stations.length - 1) { game.phase = 'arrived'; game.message = 'You made it from Hà Nội all the way to Sài Gòn.' }
  else { game.x = game.trainX; game.phase = 'moving'; game.message = `The train pulls out of ${stations[game.station].name}.`; game.activity = 'Back on the rails, heading south' }
  updateHud(); notify(game.message)
}
function restartJourney() {
  game.x = 207; game.trainX = 207; game.y = 438; game.facing = 'down'; game.walk = 0; game.moving = false
  game.orderOpen = false; game.cameraOpen = false
  document.querySelector('.phone-screen')!.classList.remove('ordering', 'camera-active')
  game.keys.clear(); game.station = 0; game.distance = 0; game.day = 1; game.clockMinutes = 6 * 60
  game.energy = 82; game.appetite = 72; game.thirst = 64
  game.message = 'You are at Hà Nội station. Take a walk before departure.'; game.activity = ''
  game.phase = 'stopped'; game.stopFrames = 0
  document.querySelector('#train-type-label')!.textContent = 'SE 1 · BLUE SLEEPER TRAIN'
  updateHud(); notify('Journey restarted from Hà Nội.')
}
function frame() {
  const speed = 1.8; let dx = 0, dy = 0
  if (game.keys.has('arrowup') || game.keys.has('w')) { dy = -speed; game.facing = 'up' }
  if (game.keys.has('arrowdown') || game.keys.has('s')) { dy = speed; game.facing = 'down' }
  if (game.keys.has('arrowleft') || game.keys.has('a')) { dx = -speed; game.facing = 'left' }
  if (game.keys.has('arrowright') || game.keys.has('d')) { dx = speed; game.facing = 'right' }
  game.moving = !!(dx || dy)
  if (game.moving) {
    const atStation = game.phase === 'stopped' || game.phase === 'arrived'
    game.x = Math.max(16, Math.min(atStation ? W - 16 : passengerSectionWidth() - 16, game.x + dx))
    // Keep onboard walking in the cabin aisle, clear of the outer bodywork and seat rows.
    game.y = Math.max(atStation ? 320 : 374, Math.min(atStation ? 455 : 418, game.y + dy))
    if (game.phase === 'moving') game.trainX = game.x
    game.walk++
  }
  if (game.phase === 'moving' && game.station < stations.length - 1) {
    game.distance = Math.min(stations[game.station + 1].km, game.distance + 0.12)
    game.clockMinutes += 0.08
    if (game.distance >= stations[game.station + 1].km) arriveAtNextStation()
    else if (game.tick % 15 === 0) updateHud()
  } else if (game.phase === 'stopped') {
    game.clockMinutes += 0.04
    if (game.autoDepart) {
      game.stopFrames++
      if (game.stopFrames >= 300) resumeJourney()
    }
    if (game.tick % 30 === 0) updateHud()
  }
  ctx.clearRect(0, 0, W, H); drawWorld(); requestAnimationFrame(frame)
}
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase()
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault()
  game.keys.add(key)
  if (key === 'e' || key === 'enter') interaction()
})
window.addEventListener('keyup', e => game.keys.delete(e.key.toLowerCase()))
window.addEventListener('blur', () => game.keys.clear())
document.querySelector('#advance')!.addEventListener('click', resumeJourney)
document.querySelector<HTMLButtonElement>('#auto-depart')!.addEventListener('click', () => {
  game.autoDepart = !game.autoDepart
  game.stopFrames = 0
  updateHud()
})
document.querySelector('#restart')!.addEventListener('click', restartJourney)
document.querySelector('#order-back')!.addEventListener('click', () => {
  game.orderOpen = false
  document.querySelector('.phone-screen')!.classList.remove('ordering')
})
document.querySelector('#camera-back')!.addEventListener('click', () => {
  game.cameraOpen = false
  document.querySelector('.phone-screen')!.classList.remove('camera-active')
})
document.querySelector('#open-camera')!.addEventListener('click', openPhoneCamera)
document.querySelector('#take-photo')!.addEventListener('click', () => {
  const data = refreshCameraView()
  if (!data) return
  const photo: SavedPhoto = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, data, date: new Date().toLocaleString() }
  game.photos.push(photo)
  const persisted = persistPhotos()
  renderGallery()
  document.querySelector('#camera-caption')!.textContent = `Photo ${game.photos.length} added to your travel gallery`
  const photoMessages: Record<CameraMode, string> = {
    station: `You saved a photo at ${stations[game.station].name}.`,
    window: 'You saved a photo of the passing scenery.',
    selfie: 'You saved a selfie from the carriage.',
    toilet: 'You saved a blurred photo with toilet privacy mode.',
  }
  game.message = persisted ? photoMessages[cameraMode()] : 'Photo added to this session’s gallery, but browser storage is full.'
  game.activity = `Saved a ${cameraMode()} photo to your travel gallery`
  updateHud(); notify(game.message)
})
document.querySelector('#open-gallery')!.addEventListener('click', () => {
  document.querySelector<HTMLButtonElement>('.info-tab[data-info="gallery"]')!.click()
})
document.querySelector('#photo-gallery')!.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-delete-photo]')
  if (!button) return
  game.photos = game.photos.filter(photo => photo.id !== button.dataset.deletePhoto)
  persistPhotos(); renderGallery()
})
document.querySelectorAll<HTMLButtonElement>('[data-order]').forEach(button => {
  button.addEventListener('click', () => {
    const name = button.dataset.name!
    if (button.dataset.order === 'food') game.appetite = Math.min(100, game.appetite + Number(button.dataset.restore))
    else {
      game.thirst = Math.min(100, game.thirst + Number(button.dataset.restore))
      if (button.dataset.energy) game.energy = Math.min(100, game.energy + Number(button.dataset.energy))
    }
    game.orderOpen = false
    document.querySelector('.phone-screen')!.classList.remove('ordering')
    game.message = `You ordered ${name} at the cafeteria.`
    game.activity = `Enjoying ${name}`
    updateHud(); notify(game.message)
  })
})
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => {
  const key = button.dataset.key!; button.addEventListener('pointerdown', e => { e.preventDefault(); game.keys.add(key) }); button.addEventListener('pointerup', () => game.keys.delete(key)); button.addEventListener('pointerleave', () => game.keys.delete(key))
})
document.querySelectorAll<HTMLButtonElement>('.info-tab').forEach(button => {
  button.addEventListener('click', () => {
    const selected = button.dataset.info
    game.orderOpen = false; game.cameraOpen = false
    document.querySelector('.phone-screen')!.classList.remove('ordering', 'camera-active')
    document.querySelectorAll('.info-tab').forEach(tab => {
      const active = tab === button
      tab.classList.toggle('active', active)
      tab.setAttribute('aria-selected', String(active))
    })
    document.querySelectorAll<HTMLElement>('.info-panel').forEach(panel => {
      panel.classList.toggle('active', panel.dataset.infoPanel === selected)
    })
    if (selected === 'track') requestAnimationFrame(renderMapZoom)
  })
})
renderGallery(); updateHud(); requestAnimationFrame(frame)
