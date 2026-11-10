import * as THREE from "three";
import { deviceLabel, NETWORK_DEVICES, type NetworkDevice } from "@/lib/network";
import { COVERAGE_COLOURS, COVERAGE_STEP, networkCoverage, type NetworkViewProps } from "@/lib/network-view";

export const SITE_SPAN = 14;
const half = SITE_SPAN / 2;
const axis = new THREE.Vector3(0,1,0);
const base = (x:number,y:number,height=0) => new THREE.Vector3(x*SITE_SPAN/100-half,height,y*SITE_SPAN/100-half);
type ModelProps = Pick<NetworkViewProps,"plan"|"simulation"|"coverageDevices"|"equipment">;
type Overlay = Pick<NetworkViewProps,"selected"|"probe"|"path">;

function box(parent:THREE.Group, material:THREE.Material, w:number,h:number,d:number,x=0,y=0,z=0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
}

function cylinder(parent:THREE.Group, material:THREE.Material, top:number,bottom:number,height:number,y:number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,12),material);
  mesh.position.y=y;
  parent.add(mesh);
  return mesh;
}

function label(text:string, reachable:boolean) {
  const canvas = document.createElement("canvas");
  canvas.width=256;
  canvas.height=54;
  const ctx=canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font="700 26px Arial";
  let printed=text;
  while (ctx.measureText(printed).width>226 && printed.length>4) printed=`${printed.slice(0,-2)}…`;
  const width=Math.min(254,ctx.measureText(printed).width+25);
  const x=(canvas.width-width)/2;
  ctx.fillStyle="#0a1426ed";
  ctx.strokeStyle=reachable ? "#7ee2c3" : "#8498ae";
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.roundRect(x,3,width,47,10);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillStyle="#f1fbff";
  ctx.fillText(printed,128,28);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,toneMapped:false}));
  sprite.scale.set(3.1,.65,1);
  sprite.renderOrder=8;
  return sprite;
}

export function makeNetworkModel({plan,simulation,coverageDevices,equipment}:ModelProps) {
  const world=new THREE.Group();
  const metal=new THREE.MeshStandardMaterial({color:0xcbe5f1,roughness:.42,metalness:.22});
  const casework=new THREE.MeshStandardMaterial({color:0x26475e,roughness:.57,metalness:.2});
  const inset=new THREE.MeshBasicMaterial({color:0x091421});
  const powered=new THREE.MeshBasicMaterial({color:0x90f7d8});
  const offline=new THREE.MeshBasicMaterial({color:0x9e794f});
  const hardware=new THREE.Group();
  world.add(hardware);
  const plate=box(world,new THREE.MeshStandardMaterial({color:0x1b3650,roughness:.8}),SITE_SPAN,.4,SITE_SPAN,0,-.2);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry),new THREE.LineBasicMaterial({color:0x46728f}));
  edge.position.y=-.2;
  world.add(edge);
  const grid=new THREE.GridHelper(SITE_SPAN,20,0x638bad,0x3c5975);
  grid.position.y=.029;
  world.add(grid);

  const cells=networkCoverage(plan,coverageDevices,equipment);
  const stamp=new THREE.Object3D();
  for (const [band,colour] of Object.entries(COVERAGE_COLOURS)) {
    const samples=cells.filter((cell)=>cell.band===band);
    if (!samples.length) continue;
    const cell=SITE_SPAN*COVERAGE_STEP/100;
    const geometry=new THREE.PlaneGeometry(cell,cell).rotateX(-Math.PI/2);
    const overlay=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color:colour,transparent:true,opacity:band==="strong"?.39:.24,depthWrite:false}),samples.length);
    samples.forEach(({x,y},index)=>{
      stamp.position.copy(base(x+COVERAGE_STEP/2,y+COVERAGE_STEP/2,.022));
      stamp.updateMatrix();
      overlay.setMatrixAt(index,stamp.matrix);
    });
    world.add(overlay);
  }

  const hitTargets:THREE.Mesh[]=[];
  const hitGeometry=new THREE.BoxGeometry(1.15,1.8,1.12);
  const hitMaterial=new THREE.MeshBasicMaterial({visible:false});
  const nodes=new Map<number,NetworkDevice>();
  for (const device of plan.devices) {
    nodes.set(device.id,device);
    const item=new THREE.Group();
    item.position.copy(base(device.x,device.y,.04));
    const live=simulation.routes.has(device.id);
    const lamp=live?powered:offline;
    const role=NETWORK_DEVICES[device.kind].role;
    cylinder(item,casework,.45,.5,.12,.06);
    let captionY=1.4;
    if (role==="uplink") {
      cylinder(item,metal,.06,.1,.62,.42);
      const mini=device.kind==="mini";
      box(item,metal,mini?.62:.96,.085,mini?.47:.71,0,.77).rotation.x=-.48;
      box(item,lamp,.14,.035,.06,0,.18,.29);
      captionY=1.55;
    } else if (role==="ap") {
      cylinder(item,metal,.045,.065,.73,.45);
      box(item,metal,.36,.44,.31,0,.85);
      box(item,lamp,.12,.036,.025,0,.79,.165);
      captionY=1.72;
    } else {
      const ports=role==="gateway"?5:8;
      box(item,casework,.94,.26,.57,0,.22);
      box(item,metal,.87,.044,.52,0,.365);
      for (let index=0;index<ports;index++) {
        const x=(index-(ports-1)/2)*(.68/ports);
        box(item,inset,.069,.067,.02,x,.205,.291);
        box(item,lamp,.03,.024,.02,x,.264,.296);
      }
    }
    const text=label(deviceLabel(device,equipment),live);
    if (text) { text.position.y=captionY;item.add(text); }
    const hit=new THREE.Mesh(hitGeometry,hitMaterial);
    hit.position.y=.86;
    hit.userData.deviceId=device.id;
    item.add(hit);
    hitTargets.push(hit);
    hardware.add(item);
  }

  const ring=new THREE.Mesh(new THREE.RingGeometry(.57,.67,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xf9d875}));
  const probe=new THREE.Group();
  cylinder(probe,new THREE.MeshBasicMaterial({color:0xf6d973}),.066,.086,.32,.22);
  const probeRing=new THREE.Mesh(new THREE.RingGeometry(.19,.255,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xf6d973}));
  probeRing.position.y=.03;
  probe.add(probeRing);
  world.add(ring,probe);

  const paths=simulation.links.flatMap(({link,warning})=>{
    const from=nodes.get(link.from), to=nodes.get(link.to);
    if (!from || !to) return [];
    const start=base(from.x,from.y,.16);
    const end=base(to.x,to.y,.16);
    const bridge=link.kind==="bridge";
    const middle=start.clone().lerp(end,.5);
    middle.y=bridge?1.75:.16;
    const curve=new THREE.QuadraticBezierCurve3(start,middle,end);
    const live=simulation.routes.has(to.id);
    const colour=warning?0xf1a480:live?(bridge?0x98adff:0x72b4cb):0x657589;
    const material=bridge||warning
      ? new THREE.LineDashedMaterial({color:colour,dashSize:.21,gapSize:.15})
      : new THREE.LineBasicMaterial({color:colour});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),material);
    line.computeLineDistances();
    world.add(line);
    const packet=live ? new THREE.Mesh(new THREE.SphereGeometry(.105,8,6),new THREE.MeshBasicMaterial({color:0x97f4d9})) : null;
    if (packet) world.add(packet);
    return [{link,colour,material,curve,packet}];
  });

  const panels=new THREE.MeshStandardMaterial({color:0x447da8,metalness:.25,roughness:.45});
  const orbitPoint=(angle:number,out:THREE.Vector3) => out.set(Math.sin(angle)*7.4,5.75+Math.cos(angle)*1.73,-4.2+Math.cos(angle)*.84);
  const points=Array.from({length:61},(_,i)=>orbitPoint(i*Math.PI/30,new THREE.Vector3()));
  const orbit=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x6488b1,transparent:true,opacity:.55}));
  world.add(orbit);
  const dish=plan.devices.find(({kind})=>NETWORK_DEVICES[kind].role==="uplink");
  const beamOrigin=dish && plan.sky ? base(dish.x,dish.y,.83) : null;
  const satellites=[0,1].map(()=>{
    const craft=new THREE.Group();
    box(craft,metal,.32,.31,.4);
    box(craft,panels,.43,.045,.28,-.39);
    box(craft,panels,.43,.045,.28,.39);
    box(craft,powered,.045,.064,.026,0,-.06,.21);
    world.add(craft);
    const beam=beamOrigin ? new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position",new THREE.BufferAttribute(new Float32Array(6),3)),
      new THREE.LineBasicMaterial({color:0xa0f1df,transparent:true,depthWrite:false}),
    ) : null;
    if (beam) { beam.frustumCulled=false;world.add(beam); }
    return {craft,beam};
  });

  function update({selected,probe:client,path}:Overlay) {
    const current=selected===null?undefined:nodes.get(selected);
    ring.visible=Boolean(current);
    if (current) ring.position.copy(base(current.x,current.y,.067));
    probe.position.copy(base(client.x,client.y,.055));
    for (const {link,colour,material,packet} of paths) {
      const active=path.some((id,index)=>id===link.from && path[index+1]===link.to);
      material.color.setHex(active?0xf0fca6:colour);
      if (packet) {
        packet.material.color.setHex(active?0xf0fca6:0x97f4d9);
        packet.scale.setScalar(active?1.36:1);
      }
    }
  }

  function tick(time:number) {
    paths.forEach(({curve,packet},index)=>{
      if (packet) curve.getPoint((time*.62+index*.21)%1,packet.position);
    });
    satellites.forEach(({craft,beam},index)=>{
      const angle=time*.31+index*Math.PI+.36;
      orbitPoint(angle,craft.position);
      craft.setRotationFromAxisAngle(axis,angle);
      if (beam && beamOrigin) {
        const positions=beam.geometry.getAttribute("position");
        positions.setXYZ(0,beamOrigin.x,beamOrigin.y,beamOrigin.z);
        const {x,y,z}=craft.position;
        positions.setXYZ(1,x,y,z);
        positions.needsUpdate=true;
        beam.material.opacity=THREE.MathUtils.smoothstep(Math.cos(angle),-.15,.5)*.83;
      }
    });
  }

  return {world,hitTargets,update,tick};
}

export function disposeNetworkModel(root:THREE.Object3D) {
  const geometries=new Set<THREE.BufferGeometry>();
  const materials=new Set<THREE.Material>();
  root.traverse((object)=>{
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)?object.material:[object.material]) materials.add(material);
    } else if (object instanceof THREE.Sprite) materials.add(object.material);
  });
  geometries.forEach((geometry)=>geometry.dispose());
  materials.forEach((material)=>{
    if (material instanceof THREE.SpriteMaterial) material.map?.dispose();
    material.dispose();
  });
}
