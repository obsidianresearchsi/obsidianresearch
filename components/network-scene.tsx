"use client";

import { useEffect, useRef, useState } from "react";
import { Move3D, Pause, Play, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { NetworkViewProps } from "@/lib/network-view";
import { NetworkLegend } from "./network-map";
import { disposeNetworkModel, makeNetworkModel, SITE_SPAN } from "./network-scene-model";

type Controls = {
  refresh: () => void;
  interact: (on:boolean) => void;
  zoom: (factor:number) => void;
  reset: () => void;
};

export default function NetworkScene({ expanded, onUnavailable, ...view }: NetworkViewProps & {
  expanded:boolean;
  onUnavailable:()=>void;
}) {
  const mount=useRef<HTMLDivElement>(null);
  const latest=useRef(view);
  const unavailable=useRef(onUnavailable);
  const runtime=useRef<Controls|null>(null);
  const model=useRef<ReturnType<typeof makeNetworkModel>|null>(null);
  const world=useRef<THREE.Scene|null>(null);
  const motion=useRef(false);
  const [touch,setTouch]=useState(false);
  const [orbit,setOrbit]=useState(false);
  const [paused,setPaused]=useState(false);
  const [ready,setReady]=useState(false);

  useEffect(()=>{ latest.current=view;unavailable.current=onUnavailable; });

  useEffect(()=>{
    const element=mount.current;
    if (!element) return;
    const coarse=window.matchMedia("(pointer: coarse)").matches;
    setTouch(coarse);
    let renderer:THREE.WebGLRenderer;
    try {
      renderer=new THREE.WebGLRenderer({antialias:!coarse,powerPreference:coarse?"low-power":"high-performance"});
    } catch {
      unavailable.current();
      return;
    }
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,coarse?1.2:1.6));
    const canvas=renderer.domElement;
    canvas.setAttribute("aria-label","Interactive 3D Starlink network and coverage map");
    element.appendChild(canvas);
    const scene=new THREE.Scene();
    scene.background=new THREE.Color("#101d31");
    scene.add(new THREE.HemisphereLight(0xd4efff,0x3e5681,2.05));
    const light=new THREE.DirectionalLight(0xe3f6ff,2.2);
    light.position.set(-7,13,8);
    scene.add(light);
    world.current=scene;

    const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,75);
    camera.position.set(11.2,13.1,19.4);
    const controls=new OrbitControls(camera,canvas);
    controls.target.set(0,2.15,0);
    controls.enablePan=false;
    controls.minZoom=.68;
    controls.maxZoom=2.6;
    controls.minPolarAngle=.14;
    controls.maxPolarAngle=Math.PI/2.18;
    controls.enabled=!coarse;
    canvas.style.touchAction=coarse?"pan-y":"none";
    controls.update();
    controls.saveState();
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible=true;
    let frame=0;
    let elapsed=0;
    let previous=0;
    let lost=false;
    function render() {
      if (frame || !visible || document.hidden || lost) return;
      frame=requestAnimationFrame((now)=>{
        frame=0;
        if (!visible || document.hidden || lost) { previous=0;return; }
        const animate=Boolean(model.current)&&!motion.current&&!reduced.matches;
        if (animate && previous) elapsed+=Math.min((now-previous)/1000,.08);
        previous=animate?now:0;
        model.current?.tick(elapsed);
        renderer.render(scene,camera);
        if (animate) render();
      });
    }
    const size=()=>{
      const width=element.clientWidth;
      const height=element.clientHeight;
      if (!width || !height) return;
      const aspect=width/height;
      const halfHeight=Math.max(9.7,10.8/aspect);
      camera.left=-halfHeight*aspect;
      camera.right=halfHeight*aspect;
      camera.top=halfHeight;
      camera.bottom=-halfHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(width,height,false);
      render();
    };
    const resize=new ResizeObserver(size);
    resize.observe(element);
    const intersection=new IntersectionObserver(([entry])=>{
      visible=Boolean(entry?.isIntersecting);
      previous=0;
      render();
    });
    intersection.observe(element);
    const visibility=()=>{previous=0;render();};
    document.addEventListener("visibilitychange",visibility);
    reduced.addEventListener("change",visibility);
    controls.addEventListener("change",render);

    const pointers=new Set<number>();
    let tap:{id:number;x:number;y:number}|null=null;
    const down=(event:PointerEvent)=>{
      pointers.add(event.pointerId);
      tap=event.button===0 && pointers.size===1 ? {id:event.pointerId,x:event.clientX,y:event.clientY} : null;
    };
    const move=(event:PointerEvent)=>{
      if (tap?.id===event.pointerId && Math.hypot(tap.x-event.clientX,tap.y-event.clientY)>7) tap=null;
    };
    const clear=(event:PointerEvent)=>{
      pointers.delete(event.pointerId);
      if (tap?.id===event.pointerId) tap=null;
    };
    const ray=new THREE.Raycaster();
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const ground=new THREE.Vector3();
    const cursor=new THREE.Vector2();
    const up=(event:PointerEvent)=>{
      const pressed=tap;
      clear(event);
      if (pressed?.id!==event.pointerId || !model.current ||
        Math.hypot(pressed.x-event.clientX,pressed.y-event.clientY)>7) return;
      const rect=canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      cursor.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      ray.setFromCamera(cursor,camera);
      const {placing,onSelect,onPoint}=latest.current;
      if (!placing) {
        const hit=ray.intersectObjects(model.current.hitTargets,false)[0];
        if (hit) { onSelect(hit.object.userData.deviceId as number);return; }
      }
      if (!ray.ray.intersectPlane(plane,ground) || Math.abs(ground.x)>SITE_SPAN/2 || Math.abs(ground.z)>SITE_SPAN/2) return;
      onPoint(THREE.MathUtils.clamp(Math.round((ground.x/SITE_SPAN+.5)*100),4,96),
        THREE.MathUtils.clamp(Math.round((ground.z/SITE_SPAN+.5)*100),5,95));
    };
    const contextLost=(event:Event)=>{
      event.preventDefault();
      lost=true;
      unavailable.current();
    };
    canvas.addEventListener("pointerdown",down);
    canvas.addEventListener("pointermove",move);
    canvas.addEventListener("pointerup",up);
    canvas.addEventListener("pointercancel",clear);
    window.addEventListener("pointerup",clear);
    window.addEventListener("pointercancel",clear);
    canvas.addEventListener("webglcontextlost",contextLost);

    runtime.current={
      refresh:render,
      interact(on) {
        if (!coarse) return;
        controls.enabled=on;
        canvas.style.touchAction=on?"none":"pan-y";
      },
      zoom(factor) {
        camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);
        camera.updateProjectionMatrix();
        render();
      },
      reset() { controls.reset();render(); },
    };
    size();
    setReady(true);

    return ()=>{
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange",visibility);
      reduced.removeEventListener("change",visibility);
      controls.removeEventListener("change",render);
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointermove",move);
      canvas.removeEventListener("pointerup",up);
      canvas.removeEventListener("pointercancel",clear);
      window.removeEventListener("pointerup",clear);
      window.removeEventListener("pointercancel",clear);
      canvas.removeEventListener("webglcontextlost",contextLost);
      controls.dispose();
      if (model.current) disposeNetworkModel(model.current.world);
      model.current=null;
      world.current=null;
      runtime.current=null;
      renderer.forceContextLoss();
      renderer.dispose();
      canvas.remove();
    };
  },[]);

  const {plan,simulation,coverageDevices,equipment,selected,probe,path}=view;
  useEffect(()=>{
    const scene=world.current;
    if (!scene) return;
    if (model.current) { scene.remove(model.current.world);disposeNetworkModel(model.current.world); }
    model.current=makeNetworkModel({plan,simulation,coverageDevices,equipment});
    model.current.update(latest.current);
    scene.add(model.current.world);
    runtime.current?.refresh();
  },[plan,simulation,coverageDevices,equipment]);
  useEffect(()=>{
    model.current?.update({selected,probe,path});
    runtime.current?.refresh();
  },[selected,probe,path]);
  useEffect(()=>{runtime.current?.interact(expanded||orbit);},[expanded,orbit]);
  useEffect(()=>{motion.current=paused;runtime.current?.refresh();},[paused]);

  return <div className="network-map-frame network-three-frame">
    <div ref={mount} className={`network-three-canvas${view.placing?" network-three-place":""}`}>
      {!ready && <p className="network-three-loading" role="status">Opening the 3D network…</p>}
    </div>
    <div className="network-three-controls" aria-label="3D network controls">
      {touch && !expanded && <button type="button" aria-pressed={orbit} onClick={()=>setOrbit(!orbit)}>
        <Move3D size={17} aria-hidden /> {orbit?"Scroll page":"Orbit and pinch"}
      </button>}
      <button type="button" aria-label="Zoom in" onClick={()=>runtime.current?.zoom(1.24)}><ZoomIn size={19} aria-hidden /></button>
      <button type="button" aria-label="Zoom out" onClick={()=>runtime.current?.zoom(1/1.24)}><ZoomOut size={19} aria-hidden /></button>
      <button type="button" aria-label="Reset camera" onClick={()=>runtime.current?.reset()}><RotateCcw size={18} aria-hidden /></button>
      <button type="button" aria-label={paused?"Play network animation":"Pause network animation"} aria-pressed={paused}
        onClick={()=>setPaused(!paused)}>{paused?<Play size={17} aria-hidden />:<Pause size={17} aria-hidden />}</button>
    </div>
    <NetworkLegend />
  </div>;
}
