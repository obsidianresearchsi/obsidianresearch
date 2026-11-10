"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PortfolioProject } from "@/lib/portfolio";

export type GallerySlot = { x: number; project: PortfolioProject };

type FramePose = { x: number; y: number; z: number; angle: number; scale: number };
type GalleryFrame = {
  group: THREE.Group;
  screen: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  cover: THREE.Texture;
  motion?: { start: number; from: FramePose; to: FramePose; wrap: boolean };
  leaving: boolean;
};

function framePose(x: number): FramePose {
  const center = x === 0;
  return { x, y: center ? 1.58 : 1.45, z: center ? 0.45 : -0.62, angle: -Math.sign(x) * 0.28, scale: center ? 1 : 0.87 };
}

function setPose(frame: GalleryFrame, pose: FramePose) {
  frame.group.position.set(pose.x, pose.y, pose.z);
  frame.group.rotation.y = pose.angle;
  frame.group.scale.setScalar(pose.scale);
}

function titleTexture(project: PortfolioProject) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 480;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 480, 768, 0);
  gradient.addColorStop(0, "#101726");
  gradient.addColorStop(1, "#3f4051");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 768, 480);
  context.strokeStyle = "#ddbd7735";
  for (let index = 0; index < 9; index++) {
    context.beginPath();
    context.arc(690, 80, 25 + index * 25, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = "#e5be77";
  context.font = "600 21px system-ui";
  context.fillText("OBSIDIAN RESEARCH", 42, 307);
  context.fillStyle = "#fff5df";
  context.font = "700 49px system-ui";
  context.fillText(project.title, 42, 384, 690);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function PortfolioScene({ slots, activeVideo, direction, motionPaused, onSelect, onStep, onVideoUnavailable, onReady }: {
  slots: GallerySlot[]; activeVideo: string; direction: number; onSelect: (id: string) => void; onStep: (step: number) => void;
  motionPaused: boolean; onVideoUnavailable: () => void; onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const sceneControl = useRef<{
    show: (slots: GallerySlot[], direction: number) => void;
    play: (url: string) => void;
    pauseMotion: (paused: boolean) => void;
  } | null>(null);
  const callbacks = useRef({ onSelect, onStep, onVideoUnavailable });
  useEffect(() => { callbacks.current = { onSelect, onStep, onVideoUnavailable }; }, [onSelect, onStep, onVideoUnavailable]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = host.current!;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: "low-power" }); }
    catch { setFailed(true); onReady(false); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.1 : 1.55));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional project gallery");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111826");
    scene.fog = new THREE.Fog("#111826", 8, 22);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 35);
    const displayCamera = camera.clone();
    const cameraOffset = new THREE.Vector3();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.36, 0);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enabled = !touch;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    controls.enableDamping = !reducedMotion.matches;
    controls.dampingFactor = 0.14;
    if (touch) renderer.domElement.style.touchAction = "pan-y";
    controls.minAzimuthAngle = -0.55;
    controls.maxAzimuthAngle = 0.55;
    controls.minPolarAngle = 1.18;
    controls.maxPolarAngle = 1.52;
    const architecture = new THREE.Group();
    scene.add(architecture);
    const floor = new THREE.GridHelper(26, 38, "#5e5260", "#293444");
    floor.position.y = -0.015;
    architecture.add(floor);
    const trim = new THREE.MeshBasicMaterial({ color: "#c5a76e" });
    const plinth = new THREE.MeshBasicMaterial({ color: "#263140" });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const plane = new THREE.PlaneGeometry(2.7, 1.7);
    const holders = new THREE.Group();
    scene.add(holders);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const ray = new THREE.Raycaster();
    const exhibits = new Map<string, GalleryFrame>();
    let centerId: string | undefined;
    let video: HTMLVideoElement | undefined;
    let videoFrame: GalleryFrame | undefined;
    let videoTexture: THREE.VideoTexture | undefined;
    let frame = 0;
    let lastTime = 0;
    let visible = false;
    let interacting = false;
    let paused = false;
    let resumeAt = 0;
    let driftTime = 0;
    let driftAmount = 0;

    function schedule() {
      if (frame || !visible || document.hidden) return;
      frame = requestAnimationFrame((now) => {
        frame = 0;
        const delta = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
        lastTime = now;
        let moving = false;
        for (const [id, exhibit] of exhibits) {
          const motion = exhibit.motion;
          if (!motion) continue;
          const progress = reducedMotion.matches ? 1 : THREE.MathUtils.clamp((now - motion.start) / 520, 0, 1);
          const t = THREE.MathUtils.smootherstep(progress, 0, 1);
          const { from, to, wrap } = motion;
          const lerp = THREE.MathUtils.lerp;
          setPose(exhibit, {
            x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t),
            z: lerp(from.z, to.z, t) - (wrap ? Math.sin(Math.PI * t) * 2.5 : 0),
            angle: lerp(from.angle, to.angle, t), scale: lerp(from.scale, to.scale, t),
          });
          if (progress < 1) moving = true;
          else {
            exhibit.motion = undefined;
            if (exhibit.leaving) removeExhibit(id, exhibit);
          }
        }
        const cameraMoving = controls.update(delta);
        const videoPlaying = Boolean(video && !video.paused && !video.ended);
        const canDrift = !reducedMotion.matches && !paused && !interacting && !videoPlaying;
        const ambient = canDrift && !moving && now >= resumeAt;
        const targetAmount = ambient ? 1 : 0;
        driftAmount = reducedMotion.matches ? 0 : THREE.MathUtils.damp(driftAmount, targetAmount, 5, delta);
        if (Math.abs(driftAmount - targetAmount) < 0.001) driftAmount = targetAmount;
        if (ambient) driftTime += delta;
        cameraOffset.copy(camera.position).sub(controls.target);
        const sway = Math.sin(driftTime * 0.65) * 0.055 * driftAmount;
        cameraOffset.applyAxisAngle(camera.up, sway);
        displayCamera.position.copy(controls.target).add(cameraOffset);
        displayCamera.position.y += Math.sin(driftTime * 0.43) * 0.12 * driftAmount;
        displayCamera.lookAt(controls.target);
        renderer.render(scene, displayCamera);
        const waitingToResume = canDrift && now < resumeAt;
        if (moving || cameraMoving || videoPlaying || ambient || waitingToResume || driftAmount !== targetAmount) schedule();
      });
    }
    const resize = () => {
      camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      displayCamera.aspect = camera.aspect;
      displayCamera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      const radius = camera.aspect < 1.25 ? 6.9 : 5.65;
      const offset = camera.position.clone().sub(controls.target);
      if (camera.position.lengthSq() === 0) offset.set(0, 0.79, radius);
      camera.position.copy(offset.setLength(Math.hypot(radius, 0.79))).add(controls.target);
      controls.update();
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else lastTime = 0;
    });
    visibility.observe(container);
    const refreshMotion = () => {
      lastTime = 0;
      controls.enableDamping = !reducedMotion.matches;
      schedule();
    };
    document.addEventListener("visibilitychange", refreshMotion);
    reducedMotion.addEventListener("change", refreshMotion);
    controls.addEventListener("change", schedule);
    controls.addEventListener("start", () => { interacting = true; schedule(); });
    controls.addEventListener("end", () => {
      interacting = false;
      resumeAt = performance.now() + 900;
      schedule();
    });

    function stopVideo() {
      if (video) {
        video.onerror = null;
        video.onloadeddata = null;
        video.pause();
        video.removeAttribute("src");
        video.load();
        video = undefined;
      }
      if (videoFrame) videoFrame.screen.material.map = videoFrame.cover;
      videoTexture?.dispose();
      videoTexture = undefined;
      videoFrame = undefined;
    }

    function removeExhibit(id: string, exhibit: GalleryFrame) {
      exhibits.delete(id);
      holders.remove(exhibit.group);
      exhibit.cover.dispose();
      exhibit.screen.material.dispose();
    }

    function createExhibit(project: PortfolioProject) {
        const bay = new THREE.Group();
        holders.add(bay);
        const stand = new THREE.Mesh(cube, plinth);
        stand.scale.set(2.8, 0.14, 0.8);
        stand.position.set(0, -1.5, -0.02);
        bay.add(stand);
        const border = new THREE.Mesh(cube, trim);
        border.scale.set(2.78, 1.78, 0.065);
        border.position.z = -0.047;
        bay.add(border);
        const cover = titleTexture(project);
        const material = new THREE.MeshBasicMaterial({ map: cover });
        const screen = new THREE.Mesh(plane, material);
        screen.userData.project = project.id;
        bay.add(screen);
        const exhibit: GalleryFrame = { group: bay, screen, cover, leaving: false };
        exhibits.set(project.id, exhibit);
        if (project.image) {
          loader.load(project.image, (texture) => {
            if (exhibits.get(project.id) !== exhibit) { texture.dispose(); return; }
            const aspect = texture.image.width / texture.image.height;
            const target = 2.7 / 1.7;
            const horizontal = Math.min(1, target / aspect);
            const vertical = Math.min(1, aspect / target);
            texture.repeat.set(horizontal, vertical);
            texture.offset.set((1 - horizontal) / 2, (1 - vertical) / 2);
            texture.colorSpace = THREE.SRGBColorSpace;
            if (material.map === exhibit.cover) material.map = texture;
            exhibit.cover.dispose();
            exhibit.cover = texture;
            schedule();
          }, undefined, () => {});
        }
        return exhibit;
    }

    function glide(exhibit: GalleryFrame, to: FramePose, start: number) {
      const { position, rotation, scale } = exhibit.group;
      const from = { x: position.x, y: position.y, z: position.z, angle: rotation.y, scale: scale.x };
      exhibit.motion = { start, from, to, wrap: Math.abs(from.x - to.x) > 4.8 && from.x * to.x < 0 };
    }

    sceneControl.current = {
      pauseMotion(nextPaused) {
        paused = nextPaused;
        schedule();
      },
      show(items, direction) {
        const initial = centerId === undefined;
        const nextCenter = items.find(({ x }) => x === 0)?.project.id;
        if (nextCenter !== centerId) stopVideo();
        centerId = nextCenter;
        const visible = new Set(items.map(({ project }) => project.id));
        const now = performance.now();
        for (const [id, exhibit] of exhibits) {
          if (visible.has(id) || exhibit.leaving) continue;
          exhibit.leaving = true;
          glide(exhibit, { ...framePose(-direction * 5.4), z: -1.55 }, now);
        }
        for (const { x, project } of items) {
          let exhibit = exhibits.get(project.id);
          const target = framePose(x);
          if (!exhibit) {
            exhibit = createExhibit(project);
            setPose(exhibit, initial ? target : { ...framePose(Math.sign(x || direction) * 5.4), z: -1.55 });
          }
          exhibit.leaving = false;
          if (!initial) glide(exhibit, target, now);
        }
        schedule();
      },
      play(file) {
        stopVideo();
        const exhibit = centerId ? exhibits.get(centerId) : undefined;
        if (file && exhibit) {
          const element = document.createElement("video");
          video = element;
          videoFrame = exhibit;
          element.crossOrigin = "anonymous";
          element.muted = true;
          element.playsInline = true;
          element.onloadeddata = () => {
            videoTexture = new THREE.VideoTexture(element);
            videoTexture.colorSpace = THREE.SRGBColorSpace;
            exhibit.screen.material.map = videoTexture;
            schedule();
          };
          element.onerror = () => callbacks.current.onVideoUnavailable();
          element.onended = schedule;
          element.onpause = schedule;
          element.src = file;
          element.play().then(schedule).catch(() => {
            if (video === element) callbacks.current.onVideoUnavailable();
          });
        }
        schedule();
      },
    };
    let press: { x: number; y: number } | undefined;
    const pointerDown = (event: PointerEvent) => { press = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event: PointerEvent) => {
      const start = press;
      press = undefined;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (event.pointerType === "touch" && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        callbacks.current.onStep(dx < 0 ? 1 : -1);
        return;
      }
      if (Math.hypot(dx, dy) > 7) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1,
        1 - (event.clientY - rect.top) / rect.height * 2), displayCamera);
      const hit = ray.intersectObjects([...exhibits.values()].filter((item) => !item.leaving).map((item) => item.screen))[0]?.object.userData.project;
      if (typeof hit === "string") callbacks.current.onSelect(hit);
    };
    const contextLost = () => { setFailed(true); onReady(false); };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    resize();
    onReady(true);
    return () => {
      sceneControl.current = null;
      stopVideo();
      for (const [id, exhibit] of exhibits) removeExhibit(id, exhibit);
      cancelAnimationFrame(frame);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", refreshMotion);
      reducedMotion.removeEventListener("change", refreshMotion);
      controls.dispose();
      cube.dispose();
      plane.dispose();
      trim.dispose();
      plinth.dispose();
      floor.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onReady]);

  useEffect(() => { sceneControl.current?.show(slots, direction); }, [slots, direction]);
  useEffect(() => { sceneControl.current?.play(activeVideo); }, [activeVideo, slots]);
  useEffect(() => { sceneControl.current?.pauseMotion(motionPaused); }, [motionPaused]);
  return <div className="portfolio-stage" ref={host}>
    {failed && <p className="portfolio-stage-fallback">Explore the projects below. This device could not open the 3D gallery.</p>}
  </div>;
}
