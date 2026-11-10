"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PAINTS, PALETTES, UNIT_FINISHES, fittedTv, tvScreenWidth, unitDimensions, type InteriorDesign } from "@/lib/interior";

export type InteriorView = "room" | "kitchen" | "lounge" | "utility";
export type InteriorViewer = { capture: (caption: string) => Promise<Blob>; zoom: (factor: number) => void };
type Material = THREE.MeshStandardMaterial;
const boxGeometry = new THREE.BoxGeometry();
const softGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.065);
const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 22);

function surface(color: string, roughness = 0.67) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(parent: THREE.Object3D, material: Material, size: number[], position: number[], soft = false) {
  const mesh = new THREE.Mesh(soft ? softGeometry : boxGeometry, material);
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Object3D, material: Material, diameter: number, height: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(cylinderGeometry, material);
  mesh.scale.set(diameter, height, diameter);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function texture(kind: "wood" | "stone" | "plaster", tint: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 256, 256);
  if (kind === "plaster") {
    for (let index = 0; index < 1400; index++) {
      ctx.fillStyle = index % 2 ? "rgba(32,25,20,.04)" : "rgba(255,255,255,.07)";
      ctx.fillRect(index * 73 % 257, (index * 47 + Math.floor(index / 11)) % 257, 1 + index % 3, 1 + index % 2);
    }
  }
  for (let index = 0; index < (kind === "wood" ? 160 : kind === "stone" ? 65 : 0); index++) {
    const x = index * 73 % 256;
    const y = index * 47 % 256;
    ctx.beginPath();
    ctx.strokeStyle = index % 2 ? "rgba(39,22,13,.10)" : "rgba(255,251,235,.13)";
    ctx.lineWidth = 0.5 + index % 3 * 0.35;
    ctx.moveTo(x, -5);
    if (kind === "wood") {
      ctx.bezierCurveTo(x + index % 16, 85, x - index % 11, 160, x + index % 9, 265);
    } else {
      ctx.bezierCurveTo(x - 84, y + 10, x + 32, y + 30, x + 72, y + 68);
    }
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function buildRoom(design: InteriorDesign) {
  const room = new THREE.Group();
  const { width, depth } = design;
  const left = -width / 2;
  const right = width / 2;
  const back = -depth / 2;
  const front = depth / 2;
  const palette = PALETTES[design.palette];
  function wallFinish(paint: InteriorDesign["paint"], screeded: boolean) {
    const color = paint === "palette" ? palette.wall : PAINTS[paint].color;
    return screeded ? new THREE.MeshStandardMaterial({ map: texture("plaster", color), roughness: 0.91 }) : surface(color, 0.83);
  }
  const wall = wallFinish(design.paint, design.screed !== "none");
  const sideWall = wallFinish(design.accentPaint, design.screed === "both");
  const wood = new THREE.MeshStandardMaterial({ map: texture("wood", palette.wood), roughness: 0.62 });
  const board = design.wood === "standard" ? null : new THREE.MeshStandardMaterial({
    map: texture("wood", design.wood === "plywood" ? "#b48b63" : "#714a37"), roughness: 0.57,
  });
  const marble = new THREE.MeshStandardMaterial({ map: texture("stone", palette.stone), roughness: 0.37 });
  const cabinetColour = UNIT_FINISHES[design.cabinetFinish].color;
  const tvColour = UNIT_FINISHES[design.tvFinish].color;
  const cabinet = surface(cabinetColour ?? palette.cabinet);
  const trim = surface("#2b2927", 0.46);
  const brass = surface("#a99060", 0.37);
  brass.metalness = 0.47;
  const glass = new THREE.MeshStandardMaterial({ color: "#b9daec", roughness: 0.23, emissive: "#344d58", emissiveIntensity: 0.45 });
  const led = new THREE.MeshStandardMaterial({ color: "#fff0bd", emissive: "#ffc386", emissiveIntensity: 1.9 });
  const black = surface("#20272b", 0.4);
  const white = surface("#eae5db");
  const fabric = surface(palette.fabric, 0.94);
  const cushion = surface(palette.accent, 0.92);
  const green = surface("#46614b", 0.8);
  const floor = [surface("#b18d6c"), surface("#be9d7b"), surface("#af8c70"), surface("#b69676")];

  box(room, trim, [width + 0.14, 0.15, depth + 0.13], [0, -0.11, 0]);
  const rows = Math.ceil(depth / 0.24);
  const strip = depth / rows;
  for (let row = 0; row < rows; row++) {
    const length = width / 4;
    const offset = row % 2 ? length / 2 : 0;
    for (let x = left - offset, index = 0; x < right - 0.01; x += length, index++) {
      const start = Math.max(x, left);
      const end = Math.min(x + length, right);
      box(room, floor[(row * 3 + index * 7) % floor.length], [end - start - 0.009, 0.045, strip - 0.008],
        [(start + end) / 2, -0.025, back + strip * (row + 0.5)]);
    }
  }
  box(room, wall, [width + 0.13, 2.93, 0.12], [0, 1.465, back - 0.05]);
  box(room, white, [width, 0.095, 0.035], [0, 0.052, back + 0.027]);
  const windowStart = back + depth * 0.33;
  const windowEnd = back + depth * 0.8;
  const windowSpan = windowEnd - windowStart;
  const windowMiddle = (windowStart + windowEnd) / 2;
  box(room, sideWall, [0.13, 2.93, windowStart - back], [left - 0.05, 1.465, (windowStart + back) / 2]);
  box(room, sideWall, [0.13, 2.93, front - windowEnd], [left - 0.05, 1.465, (windowEnd + front) / 2]);
  box(room, sideWall, [0.13, 0.84, windowSpan], [left - 0.05, 0.42, windowMiddle]);
  box(room, sideWall, [0.13, 0.39, windowSpan], [left - 0.05, 2.735, windowMiddle]);
  box(room, glass, [0.018, 1.68, windowSpan - 0.09], [left - 0.073, 1.69, windowMiddle]);
  for (const z of [windowStart + 0.02, windowMiddle, windowEnd - 0.02]) {
    box(room, trim, [0.077, 1.72, 0.04], [left, 1.69, z]);
  }
  for (const y of [0.85, 1.35, 2.53]) box(room, trim, [0.08, 0.04, windowSpan], [left, y, windowMiddle]);
  box(room, marble, [0.3, 0.05, windowSpan + 0.13], [left + 0.06, 0.83, windowMiddle]);

  const { cabinet: run, wall: wallWidth } = unitDimensions(design);
  const kitchenLeft = left + 0.18;
  const kitchenCenter = kitchenLeft + run / 2;
  if (design.includeCabinets) {
    const slots = Math.max(3, Math.round(run / 0.57));
    const slot = run / slots;
    box(room, trim, [run, 0.105, 0.54], [kitchenCenter, 0.055, back + 0.28]);
    box(room, cabinet, [run, 0.78, 0.61], [kitchenCenter, 0.48, back + 0.305]);
    box(room, marble, [run + 0.055, 0.065, 0.69], [kitchenCenter, 0.91, back + 0.34]);
    box(room, marble, [run, 0.64, 0.035], [kitchenCenter, 1.26, back + 0.02]);
    const upper = design.cabinet === "twoTone" ? white : cabinet;
    box(room, upper, [run, 0.72, 0.35], [kitchenCenter, 1.97, back + 0.18]);
    box(room, led, [run - 0.12, 0.017, 0.023], [kitchenCenter, 1.598, back + 0.29]);
    const baseDoor = cabinetColour ? cabinet : board ?? (design.cabinet === "fluted" ? wood : cabinet);
    for (let index = 0; index < slots; index++) {
      const x = kitchenLeft + slot * (index + 0.5);
      for (const [y, h, z] of [[0.49, 0.75, back + 0.628], [1.97, 0.7, back + 0.37]]) {
        const door = design.cabinet === "twoTone" && y > 1 ? upper : baseDoor;
        box(room, door, [slot - 0.023, h, 0.035], [x, y, z]);
        if (design.cabinet === "shaker") {
          for (const side of [-1, 1]) {
            box(room, door, [0.038, h, 0.025], [x + side * (slot / 2 - 0.032), y, z + 0.024]);
            box(room, door, [slot - 0.052, 0.04, 0.025], [x, y + side * (h / 2 - 0.024), z + 0.024]);
          }
          box(room, brass, [Math.min(0.19, slot * 0.47), 0.018, 0.036], [x, y + (y < 1 ? 0.27 : -0.25), z + 0.044], true);
        }
        if (design.cabinet === "fluted") {
          for (let reed = 0; reed < 10; reed++) {
            box(room, reed % 2 ? door : cabinet, [slot * 0.045, h - 0.02, 0.022],
              [x + slot * (reed / 10 - 0.45), y, z + 0.023], true);
          }
        }
      }
    }
    if (design.sink) {
      const sinkX = kitchenLeft + run * 0.71;
      box(room, black, [0.48, 0.018, 0.37], [sinkX, 0.948, back + 0.32], true);
      cylinder(room, brass, 0.024, 0.27, sinkX, 1.083, back + 0.14);
      box(room, brass, [0.024, 0.023, 0.14], [sinkX, 1.206, back + 0.204], true);
    }
    if (design.hob) {
      const hobX = kitchenLeft + run * 0.27;
      box(room, black, [0.48, 0.018, 0.43], [hobX, 0.949, back + 0.35], true);
      for (const x of [-0.12, 0.12]) for (const z of [-0.1, 0.1]) {
        cylinder(room, trim, 0.15, 0.009, hobX + x, 0.963, back + 0.35 + z);
      }
    }
  }

  const wallCenter = design.includeWall ? right - 0.18 - wallWidth / 2 : right - width * 0.19;
  if (design.includeWall) {
    const tvSurface = tvColour ? surface(tvColour, 0.66) : null;
    const backdrop = design.wall === "stone"
      ? tvColour ? new THREE.MeshStandardMaterial({ map: texture("stone", tvColour), roughness: 0.37 }) : marble
      : design.wall === "slats" ? trim : tvSurface ?? surface(palette.cabinet);
    box(room, backdrop, [wallWidth, 2.47, 0.08], [wallCenter, 1.37, back + 0.055]);
    if (design.wall === "slats") {
      for (let x = -wallWidth / 2 + 0.025; x < wallWidth / 2; x += 0.055) {
        box(room, tvSurface ?? wood, [0.028, 2.43, 0.04], [wallCenter + x, 1.37, back + 0.103]);
      }
      box(room, led, [wallWidth * 0.87, 0.022, 0.02], [wallCenter, 2.535, back + 0.135]);
    }
    if (design.wall === "floating") {
      for (const y of [0.83, 2.08, 2.37]) {
        box(room, wood, [wallWidth + 0.06, 0.065, 0.25], [wallCenter, y, back + 0.19]);
        box(room, white, [0.19, 0.16, 0.12], [wallCenter + wallWidth * 0.34, y + 0.113, back + 0.15]);
      }
    }
    if (design.wall === "framed") {
      for (const side of [-1, 1]) {
        box(room, wood, [0.055, 2.44, 0.08], [wallCenter + side * (wallWidth / 2 - 0.028), 1.37, back + 0.134]);
        box(room, wood, [wallWidth - 0.11, 0.055, 0.08], [wallCenter, 1.37 + side * 1.192, back + 0.134]);
      }
      box(room, led, [wallWidth - 0.16, 0.022, 0.02], [wallCenter, 2.52, back + 0.14]);
    }
    const tv = fittedTv(design, wallWidth);
    if (tv !== "none") {
      const screen = new THREE.MeshStandardMaterial({ color: "#273645", emissive: "#0d1b29", emissiveIntensity: 0.35, roughness: 0.26 });
      const screenWidth = tvScreenWidth(tv);
      const screenHeight = screenWidth * 9 / 16;
      box(room, black, [screenWidth, screenHeight, 0.065], [wallCenter, 1.61, back + 0.167], true);
      box(room, screen, [screenWidth - 0.036, screenHeight - 0.037, 0.016], [wallCenter, 1.61, back + 0.208]);
    }
    if (design.console) {
      box(room, tvSurface ?? (design.wall === "stone" ? white : wood), [wallWidth * 0.98, 0.29, 0.48], [wallCenter, 0.51, back + 0.27], true);
      for (const x of [-0.24, 0.24]) box(room, trim, [0.19, 0.009, 0.015], [wallCenter + x, 0.571, back + 0.515]);
    }
  }

  const loungeZ = Math.min(front - 0.75, back + depth * 0.69);
  const loungeWidth = Math.min(2.25, width * 0.39);
  const loungeCenter = THREE.MathUtils.clamp(wallCenter, left + loungeWidth / 2 + 0.3, right - loungeWidth / 2 - 0.3);
  box(room, fabric, [loungeWidth + 0.33, 0.018, Math.min(1.95, depth * 0.43)], [loungeCenter - 0.1, 0.013, loungeZ - 0.37]);
  box(room, fabric, [loungeWidth, 0.3, 0.8], [loungeCenter, 0.28, loungeZ], true);
  box(room, fabric, [loungeWidth, 0.58, 0.21], [loungeCenter, 0.55, loungeZ + 0.31], true);
  for (const sign of [-1, 1]) {
    box(room, fabric, [0.19, 0.46, 0.77], [loungeCenter + sign * (loungeWidth / 2 - 0.1), 0.42, loungeZ], true);
    box(room, white, [loungeWidth * 0.39, 0.12, 0.55], [loungeCenter + sign * loungeWidth * 0.208, 0.472, loungeZ - 0.06], true);
    box(room, cushion, [0.34, 0.35, 0.14], [loungeCenter + sign * loungeWidth * 0.25, 0.645, loungeZ + 0.115], true).rotation.z = sign * 0.12;
  }
  cylinder(room, trim, 0.29, 0.28, loungeCenter - 0.05, 0.16, loungeZ - 0.98);
  cylinder(room, marble, 0.7, 0.07, loungeCenter - 0.05, 0.335, loungeZ - 0.98);
  box(room, cushion, [0.18, 0.034, 0.23], [loungeCenter - 0.18, 0.39, loungeZ - 0.91], true);
  cylinder(room, white, 0.11, 0.14, loungeCenter + 0.085, 0.44, loungeZ - 1.07);

  const tableX = left + Math.min(1.3, width * 0.26);
  const tableZ = Math.min(front - 0.86, back + depth * 0.68);
  cylinder(room, trim, 0.19, 0.71, tableX, 0.37, tableZ);
  cylinder(room, wood, 0.95, 0.07, tableX, 0.75, tableZ);
  cylinder(room, white, 0.18, 0.19, tableX, 0.875, tableZ);
  for (const sign of [-1, 1]) {
    const chairZ = tableZ + sign * 0.66;
    box(room, fabric, [0.4, 0.095, 0.42], [tableX, 0.44, chairZ], true);
    box(room, wood, [0.4, 0.35, 0.066], [tableX, 0.65, chairZ + sign * 0.16], true);
    for (const x of [-0.15, 0.15]) for (const z of [-0.14, 0.14]) {
      box(room, trim, [0.036, 0.4, 0.036], [tableX + x, 0.2, chairZ + z]);
    }
  }
  cylinder(room, trim, 0.021, 0.55, tableX, 2.61, tableZ);
  cylinder(room, brass, 0.42, 0.22, tableX, 2.25, tableZ);
  cylinder(room, led, 0.34, 0.014, tableX, 2.134, tableZ);
  const plantX = left + 0.32;
  const plantZ = front - 0.41;
  cylinder(room, marble, 0.32, 0.32, plantX, 0.17, plantZ);
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4;
    const leaf = box(room, green, [0.13, 0.38, 0.045],
      [plantX + Math.cos(angle) * 0.15, 0.53 + i % 3 * 0.13, plantZ + Math.sin(angle) * 0.15], true);
    leaf.rotation.set(Math.sin(angle) * 0.42, angle, Math.cos(angle) * 0.54);
  }

  const utilityZ = back + depth * 0.45;
  if (design.internet !== "none" || design.backup !== "none") {
    box(room, trim, [0.98, 0.064, 1.02], [right + 0.46, 0.02, utilityZ], true);
    box(room, white, [0.06, 1.48, 1.03], [right - 0.055, 0.74, utilityZ]);
  }
  if (design.internet !== "none") {
    const standard = design.internet === "standard";
    cylinder(room, trim, 0.057, 0.72, right + 0.48, 0.409, utilityZ - 0.25);
    const dish = box(room, white, [0.047, standard ? 0.48 : 0.32, standard ? 0.58 : 0.37],
      [right + 0.48, 0.91, utilityZ - 0.25], true);
    dish.rotation.z = -0.6;
    if (standard) {
      box(room, white, [0.24, 0.24, 0.08], [wallCenter + wallWidth * 0.31, 0.79, back + 0.36], true);
      box(room, led, [0.034, 0.008, 0.011], [wallCenter + wallWidth * 0.31, 0.71, back + 0.407]);
    }
  }
  if (design.backup !== "none") {
    box(room, white, [0.16, design.backup === "hybrid" ? 0.52 : 0.42, 0.34], [right + 0.06, 1.17, utilityZ + 0.23], true);
    box(room, black, [0.012, 0.13, 0.22], [right + 0.144, 1.2, utilityZ + 0.23], true);
    box(room, led, [0.014, 0.031, 0.10], [right + 0.153, 1.21, utilityZ + 0.23]);
    const batteries = design.backup === "tubular" ? 2 : 1;
    for (let i = 0; i < batteries; i++) {
      box(room, design.backup === "tubular" ? black : white, [0.47, 0.26, batteries === 2 ? 0.22 : 0.4],
        [right + 0.31, 0.21, utilityZ + 0.05 + i * 0.25], true);
    }
  }
  const batches = new Map<Material, Map<THREE.BufferGeometry, THREE.Mesh[]>>();
  for (const child of room.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    const material = child.material as Material;
    if (!batches.has(material)) batches.set(material, new Map());
    const geometries = batches.get(material)!;
    const meshes = geometries.get(child.geometry) ?? [];
    meshes.push(child);
    geometries.set(child.geometry, meshes);
  }
  for (const [material, geometries] of batches) for (const [geometry, meshes] of geometries) {
    if (meshes.length < 3) continue;
    const combined = new THREE.InstancedMesh(geometry, material, meshes.length);
    combined.castShadow = combined.receiveShadow = true;
    meshes.forEach((mesh, index) => {
      mesh.updateMatrix();
      combined.setMatrixAt(index, mesh.matrix);
      room.remove(mesh);
    });
    room.add(combined);
  }
  return room;
}

function disposeRoom(room: THREE.Object3D) {
  const materials = new Set<Material>();
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) materials.add(object.material as Material);
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}

function cameraFor(view: InteriorView, design: InteriorDesign) {
  const { width, depth } = design;
  const units = unitDimensions(design);
  if (view === "kitchen") {
    const x = units.cabinet ? -width / 2 + 0.18 + units.cabinet / 2 : -width * 0.23;
    return { position: [x + 0.65, 2.16, -depth / 2 + Math.max(2.7, units.cabinet * 1.16)], target: [x, 1.23, -depth / 2 + 0.3] };
  }
  if (view === "lounge") {
    const x = units.wall ? width / 2 - 0.18 - units.wall / 2 : width * 0.27;
    return { position: [x + 0.65, 2.14, -depth / 2 + Math.max(2.7, units.wall * 1.16)], target: [x, 1.25, -depth / 2 + 0.2] };
  }
  if (view === "utility") return { position: [width * 0.99, 2.16, depth * 0.17], target: [width * 0.5 + 0.27, 0.86, -depth * 0.05] };
  return { position: [width * 0.83, Math.max(width, depth) * 0.67, depth * 1.02], target: [0, 0.82, -depth * 0.1] };
}

export default function InteriorScene({ design, view, evening, reset, viewer, onAvailable, expanded }: {
  design: InteriorDesign; view: InteriorView; evening: boolean; reset: number;
  viewer: RefObject<InteriorViewer | null>; onAvailable: (available: boolean) => void; expanded: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<{
    model: (value: InteriorDesign) => void;
    move: (value: InteriorView, design: InteriorDesign) => void;
    light: (dark: boolean) => void;
    interact: (enabled: boolean) => void;
  } | null>(null);
  const lastLayout = useRef({ design, view, evening, reset });
  const [failed, setFailed] = useState(false);
  const [touchScreen, setTouchScreen] = useState(false);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => {
    const element = host.current!;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    setTouchScreen(touch);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: touch ? "low-power" : "high-performance" });
    } catch {
      setFailed(true);
      onAvailable(false);
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.15 : 1.6));
    renderer.domElement.setAttribute("aria-label", "Interactive 3D room preview");
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(43, 1, 0.08, 60);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = !touch;
    if (touch) renderer.domElement.style.touchAction = "pan-y";
    controls.enablePan = false;
    controls.minDistance = 1.7;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI / 2.03;
    controls.minPolarAngle = 0.31;
    controls.minAzimuthAngle = -0.18;
    controls.maxAzimuthAngle = 1.52;
    const sky = new THREE.HemisphereLight("#fff0dc", "#788195", 2.05);
    const key = new THREE.DirectionalLight("#fff0d8", 2.15);
    key.position.set(-3, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(touch ? 512 : 1024);
    key.shadow.normalBias = 0.027;
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, far: 27 });
    const fill = new THREE.DirectionalLight("#d5e6ff", 0.65);
    fill.position.set(5, 4, 5);
    const pendant = new THREE.PointLight("#ffc887", 14, 8, 2);
    scene.add(sky, key, fill, pendant);
    const base = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), surface("#34404a"));
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.205;
    base.receiveShadow = true;
    scene.add(base);
    let room: THREE.Group | undefined;
    let width = 1, height = 1;
    let frame = 0;
    let motion: { start: number; from: THREE.Vector3; to: THREE.Vector3; targetFrom: THREE.Vector3; targetTo: THREE.Vector3 } | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function render() {
      if (!frame) frame = requestAnimationFrame((now) => {
        frame = 0;
        if (motion) {
          const progress = Math.min(1, Math.max(0, (now - motion.start) / 280));
          const eased = 1 - (1 - progress) ** 3;
          camera.position.lerpVectors(motion.from, motion.to, eased);
          controls.target.lerpVectors(motion.targetFrom, motion.targetTo, eased);
          camera.lookAt(controls.target);
          if (progress === 1) {
            motion = null;
            controls.update();
          }
        }
        renderer.render(scene, camera);
        if (motion) render();
      });
    }
    function size() {
      width = Math.max(1, element.clientWidth);
      height = Math.max(1, element.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }
    const observer = new ResizeObserver(size);
    observer.observe(element);
    controls.addEventListener("change", render);
    const cancelMotion = () => { motion = null; };
    controls.addEventListener("start", cancelMotion);
    runtime.current = {
      model(value) {
        if (room) { scene.remove(room); disposeRoom(room); }
        room = buildRoom(value);
        pendant.position.set(-value.width * 0.25, 2.11, value.depth * 0.17);
        scene.add(room);
        renderer.shadowMap.needsUpdate = true;
        render();
      },
      move(nextView, value) {
        const next = cameraFor(nextView, value);
        const scale = width / height < 1.18 ? 1.2 : 1;
        const target = new THREE.Vector3().fromArray(next.target);
        const position = new THREE.Vector3().fromArray(next.position).sub(target).multiplyScalar(scale).add(target);
        if (!reducedMotion && camera.position.lengthSq() > 0) {
          motion = { start: performance.now(), from: camera.position.clone(), to: position, targetFrom: controls.target.clone(), targetTo: target };
        } else {
          controls.target.copy(target);
          camera.position.copy(position);
          controls.update();
        }
        render();
      },
      light(dark) {
        scene.background = new THREE.Color(dark ? "#202932" : "#515f6c");
        sky.intensity = dark ? 0.75 : 2.05;
        key.intensity = dark ? 0.55 : 2.15;
        fill.intensity = dark ? 0.28 : 0.65;
        pendant.intensity = dark ? 38 : 13;
        renderer.toneMappingExposure = dark ? 1.19 : 1;
        render();
      },
      interact(enabled) {
        if (!touch) return;
        controls.enabled = enabled;
        renderer.domElement.style.touchAction = enabled ? "none" : "pan-y";
      },
    };
    const current = lastLayout.current;
    size();
    runtime.current.model(current.design);
    runtime.current.move(current.view, current.design);
    runtime.current.light(current.evening);
    viewer.current = { zoom(factor) {
      motion = null;
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset);
      controls.update();
      render();
    }, capture(caption) {
      const output = document.createElement("canvas");
      output.width = 1600;
      output.height = 1040;
      const ctx = output.getContext("2d")!;
      const pixelRatio = renderer.getPixelRatio();
      try {
        renderer.setPixelRatio(1);
        renderer.setSize(1600, 944, false);
        camera.aspect = 1600 / 944;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        ctx.drawImage(renderer.domElement, 0, 0);
      } finally {
        renderer.setPixelRatio(pixelRatio);
        size();
      }
      ctx.fillStyle = "#111922";
      ctx.fillRect(0, 944, 1600, 96);
      ctx.font = "600 28px system-ui";
      ctx.fillStyle = "#fff4df";
      ctx.fillText("OBSIDIAN RESEARCH  /  INTERIOR STUDIO", 36, 985);
      ctx.font = "21px system-ui";
      ctx.fillStyle = "#ccbdab";
      ctx.fillText(caption, 36, 1019, 1500);
      return new Promise<Blob>((resolve, reject) => output.toBlob((blob) =>
        blob ? resolve(blob) : reject(new Error("The room image could not be captured.")), "image/jpeg", 0.88));
    } };
    onAvailable(true);
    const contextLost = (event: Event) => {
      event.preventDefault();
      viewer.current = null;
      onAvailable(false);
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      observer.disconnect();
      cancelAnimationFrame(frame);
      controls.removeEventListener("start", cancelMotion);
      controls.dispose();
      if (room) disposeRoom(room);
      base.geometry.dispose();
      base.material.dispose();
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
      viewer.current = null;
    };
  }, [viewer, onAvailable]);

  useEffect(() => {
    const previous = lastLayout.current;
    const previousUnits = unitDimensions(previous.design);
    const units = unitDimensions(design);
    const dimensionsChanged = previous.design.width !== design.width || previous.design.depth !== design.depth
      || (view === "kitchen" && previousUnits.cabinet !== units.cabinet)
      || (view === "lounge" && previousUnits.wall !== units.wall);
    if (previous.design !== design) runtime.current?.model(design);
    if (dimensionsChanged || previous.view !== view || previous.reset !== reset) runtime.current?.move(view, design);
    if (previous.evening !== evening) runtime.current?.light(evening);
    lastLayout.current = { design, view, evening, reset };
  }, [design, view, evening, reset]);

  useEffect(() => {
    runtime.current?.interact(expanded || interacting);
  }, [expanded, interacting]);

  return <div className="interior-viewport" ref={host}>
    {touchScreen && !failed && !expanded && <button className="interior-touch" type="button" aria-pressed={interacting}
      onClick={() => setInteracting(!interacting)}>
      {interacting ? "Scroll page" : "Drag and pinch"}
    </button>}
    {failed && <div className="interior-fallback"><strong>3D preview is unavailable on this device.</strong><p>You can still configure your room, see the estimate and send your selections for review.</p></div>}
  </div>;
}
