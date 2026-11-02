import * as THREE from 'three';
// Photo-guided geometric study. Dimensions are model units, not surveyed metres.
export const photoMaterials={
 wood:new THREE.MeshStandardMaterial({name:'photo_wood',color:0x796247,roughness:.97}),
 dark:new THREE.MeshStandardMaterial({name:'photo_darkwood',color:0x4f4637,roughness:1}),
 roof:new THREE.MeshStandardMaterial({name:'photo_roof',color:0x696558,roughness:1,side:THREE.DoubleSide}),
 trim:new THREE.MeshStandardMaterial({name:'photo_trim',color:0x8c795b,roughness:.92}),
 stone:new THREE.MeshStandardMaterial({name:'photo_stone',color:0xb0aa98,roughness:1}),
 panel:new THREE.MeshStandardMaterial({name:'photo_panel',color:0xb9ad91,roughness:1}),
 shadow:new THREE.MeshStandardMaterial({name:'photo_shadow',color:0x292a22,roughness:1}),
 green:new THREE.MeshStandardMaterial({name:'photo_green',color:0x596348,roughness:1})};
const M=photoMaterials;
function box(g,name,w,h,d,x,y,z,mat=M.wood){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function beam(g,name,a,b,r,mat=M.wood){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),v=vb.clone().sub(va);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),6),mat);m.name=name;m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());m.castShadow=true;g.add(m);return m;}
function roof(g,{width,depth,eave,rise,up=.22,name='curved-roof'}){
 const nx=28,nz=32,positions=[],indices=[];
 function point(i,j){const x=(i/nx-.5)*width,t=j/nz*2-1;
 // Convex sweep toward the ridge and a shallow lifted eave at the outermost edge.
 const crown=Math.pow(1-Math.abs(t),1.55),lift=up*Math.pow(Math.abs(t),10),endLift=.075*Math.pow(Math.abs(x/(width/2)),12);
 return [x,eave+rise*crown+lift+endLift,t*depth/2];}
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++)positions.push(...point(i,j));
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=i*(nz+1)+j,b=a+nz+1;indices.push(a,b,a+1,b,b+1,a+1)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();const surf=new THREE.Mesh(geo,M.roof);surf.name=name;surf.castShadow=true;surf.receiveShadow=true;g.add(surf);
 for(const end of [0,nx]){for(let j=0;j<nz;j++)beam(g,'gable-edge',point(end,j),point(end,j+1),.085,M.trim)}
 for(const edge of [0,nz]){for(let i=0;i<nx;i++)beam(g,'eave-fascia',point(i,edge),point(i+1,edge),.075,M.dark)}
 // Narrow continuous roof courses indicate texture only; actual roof material is unconfirmed.
 for(let j=2;j<nz;j+=2){const pts=[];for(let i=0;i<=nx;i++){const p=point(i,j);p[1]+=.018;pts.push(new THREE.Vector3(...p))}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x817b68,transparent:true,opacity:.32}));line.name='roof-course';g.add(line)}
 beam(g,'ridge',[-width/2-.12,eave+rise+.1,0],[width/2+.12,eave+rise+.1,0],.10,M.trim);
 for(const sign of [-1,1])beam(g,'ridge-upturn',[sign*width/2,eave+rise+.1,0],[sign*(width/2+.30),eave+rise+.2,0],.065,M.trim);
 return eave+rise+.2;
}
function lattice(g,w,h,x,y,z,side=false){
 const p=box(g,'window-backing',w,h,.055,x,y,z,M.shadow);if(side)p.rotation.y=Math.PI/2;
 const bars=new THREE.Group();bars.position.set(x,y,z);if(side)bars.rotation.y=Math.PI/2;g.add(bars);
 for(let u=-w/2;u<=w/2+.001;u+=.16)box(bars,'window-lattice',.025,h,.045,u,0,.035,M.trim);
 for(let v=-h/2;v<=h/2+.001;v+=.18)box(bars,'window-crossbar',w,.022,.045,0,v,.04,M.trim);
}
function stairs(g,width,front,top,count=4){for(let i=0;i<count;i++){const h=top*(i+1)/count;box(g,'stone-step',width,h,(count-i)*.32,0,h/2,front+(count-i)*.16,M.stone)}}
function gate(){const g=new THREE.Group();g.name='N-photo-gate';box(g,'gate-platform',6.0,.24,3.7,0,.12,0,M.stone);stairs(g,3.9,1.85,.24,2);
 for(const x of [-2.4,2.4])for(const z of [-1.1,1.1])box(g,'gate-post',.19,2.75,.19,x,1.615,z,M.wood);
 box(g,'gate-beam',5.05,.24,.28,0,2.87,1.1,M.dark);box(g,'gate-beam',5.05,.24,.28,0,2.87,-1.1,M.dark);
 box(g,'closed-gate',3.8,1.96,.13,0,1.28,.18,M.dark);
 for(let x=-1.85;x<=1.86;x+=.15)box(g,'gate-slats',.038,1.92,.06,x,1.28,.27,M.trim);
 for(const y of [.5,1.48,2.19])box(g,'gate-rail',3.8,.08,.12,0,y,.29,M.wood);
 for(const x of [-1.98,0,1.98])box(g,'door-frame',.13,2.3,.18,x,1.37,.3,M.wood);
 roof(g,{width:6.1,depth:4.05,eave:2.96,rise:1.36,up:.15});
 for(const x of [-2.43,2.43]){beam(g,'gable-brace',[x,2.95,-1.25],[x,4.20,0],.055,M.dark);beam(g,'gable-brace',[x,4.20,0],[x,2.95,1.25],.055,M.dark)}return g;}
function hall(){const g=new THREE.Group();g.name='P-photo-hall';box(g,'hall-plinth',8.5,.7,6.0,0,.35,0,M.stone);box(g,'plinth-cap',8.8,.15,6.25,0,.775,0,M.stone);stairs(g,3.6,3.1,.85,5);
 box(g,'interior-shadow',6.4,2.65,4.1,0,2.17,-.22,M.shadow);
 // Three front bays, central entrance, and flanking latticed openings are visible in the source.
 for(const x of [-3.6,-1.2,1.2,3.6])for(const z of [-2.4,2.4])box(g,'hall-column',.19,2.9,.19,x,2.30,z,M.wood);
 for(const x of [-3.6,3.6])for(const z of [-.8,.8])box(g,'side-column',.17,2.9,.17,x,2.30,z,M.wood);
 box(g,'front-lintel',7.5,.22,.28,0,3.65,2.4,M.dark);box(g,'back-lintel',7.5,.22,.28,0,3.65,-2.4,M.dark);
 for(const x of [-3.6,3.6])box(g,'side-lintel',.25,.22,5.0,x,3.65,0,M.dark);
 for(const x of [-2.4,2.4])lattice(g,1.95,2.25,x,2.08,2.43);
 box(g,'entrance-dark',2.1,2.4,.09,0,2.06,2.48,M.shadow);
 for(const x of [-1.02,1.02])box(g,'door-jamb',.09,2.4,.13,x,2.06,2.52,M.trim);
 for(const x of [-3.6,3.6])lattice(g,2.15,1.9,x,2.18,.2,true);
 for(let x=-3.65;x<3.7;x+=.24)box(g,'eave-rafter',.07,.10,.55,x,3.82,2.7,M.trim);
 // Low side eaves reflect the layered roof silhouette seen in the photograph.
 for(const x of [-4.1,4.1]){const wing=new THREE.Group();wing.position.set(x,0,0);roof(wing,{width:3.0,depth:6.7,eave:3.25,rise:.48,up:.15,name:'lower-side-roof'});g.add(wing)}
 roof(g,{width:7.3,depth:7.6,eave:3.9,rise:2.18,up:.22,name:'main-sweeping-roof'})/* 寬度依 2026-11 老照片對位修正（原 10.6）*/;return g;}
function sanctuary(){const g=new THREE.Group();g.name='Q-photo-partial-study';box(g,'sanctuary-base',4.15,.65,4.6,0,.325,0,M.stone);box(g,'raised-floor',3.55,.24,4.0,0,.83,0,M.wood);
 for(const x of [-1.55,1.55])for(const z of [-1.7,1.7])box(g,'sanctuary-post',.16,2.65,.16,x,2.25,z,M.wood);
 box(g,'sanctuary-body',3.08,2.45,3.4,0,2.23,0,M.wood);lattice(g,1.2,1.85,0,2.15,1.73);
 const r=new THREE.Group();r.rotation.y=Math.PI/2;roof(r,{width:5.5,depth:4.8,eave:3.45,rise:1.48,up:.17});
 // Only roof silhouette/finials are partly visible; hidden body and rear remain inferred.
 for(const end of [-1,1]){const x=end*2.1;beam(r,'forked-finial',[x,4.70,0],[x,5.55,.50],.06,M.trim);beam(r,'forked-finial',[x,4.70,0],[x,5.55,-.50],.06,M.trim)}
 for(const x of [-1.35,-.45,.45,1.35])beam(r,'ridge-billet',[x,5.02,-.32],[x,5.02,.32],.075,M.trim);
 g.add(r);stairs(g,1.8,2.30,.95,5);return g;}
function fenceRun(g,a,b,height=1.55,roofed=true){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),len=A.distanceTo(B),group=new THREE.Group();group.position.copy(A).add(B).multiplyScalar(.5);group.rotation.y=-Math.atan2(B.z-A.z,B.x-A.x);g.add(group);
 box(group,'fence-stone-foot',len,.24,.42,0,.12,0,M.stone);for(const y of [.37,height-.15])box(group,'fence-rail',len,.09,.13,0,y,0,M.wood);
 const n=Math.max(1,Math.round(len/.22));for(let i=0;i<=n;i++)box(group,'vertical-fence-slat',.065,height-.30,.075,-len/2+len*i/n,(height+.30)/2,0,M.wood);
 const posts=Math.ceil(len/1.6);for(let i=0;i<=posts;i++)box(group,'fence-post',.12,height+.1,.12,-len/2+len*i/posts,(height+.1)/2,0,M.dark);
 if(roofed){roof(group,{width:len+.16,depth:.66,eave:height+.06,rise:.17,up:.018,name:'fence-cap'});for(let x=-len/2;x<len/2;x+=.20)for(const sign of [-1,1])beam(group,'individual-cap-board',[x,height+.24,0],[x,height+.08,sign*.36],.022,M.trim)}else box(group,'fence-top',len,.08,.18,0,height+.10,0,M.trim);return group;}
function enclosure(rear=false){const g=new THREE.Group(),w=rear?7.18:16.94,d=rear?11.2:12.38,h=rear?1.95:2.10;
 if(!rear){fenceRun(g,[-w/2,0,d/2],[-3.05,0,d/2],h);fenceRun(g,[3.05,0,d/2],[w/2,0,d/2],h)}else fenceRun(g,[-w/2,0,-d/2],[w/2,0,-d/2],h,false);
 fenceRun(g,[-w/2,0,-d/2],[-w/2,0,d/2],h,!rear);fenceRun(g,[w/2,0,-d/2],[w/2,0,d/2],h,!rear);return g;}
export function createPhotoPart(code,zUp=false){let g=({N:gate,P:hall,Q:sanctuary,R:()=>enclosure(false),S:()=>enclosure(true)})[code]?.();if(!g)throw Error('Unknown photo component '+code);g.userData.evidence=code==='Q'?'partial-roof-inferred-body':'visible-photo-and-original-plan';if(!zUp)return g;const outer=new THREE.Group();g.rotation.x=Math.PI/2;outer.add(g);return outer;}
export const photoPlacements={N:[9.66,3.85,-.99],P:[9.55,3.85,-13.08],Q:[9.5,5.16,-21.69],R:[9.55,4.3,-7.83],S:[9.55,4.5,-20.8]};
export function createPhotoCore(){const root=new THREE.Group();for(const code of ['N','P','Q','R','S']){const part=createPhotoPart(code);part.position.set(...photoPlacements[code]);part.userData.code=code;root.add(part)}const grounds=new THREE.Group();grounds.name='context-plinths';box(grounds,'front-court',22,.18,22,9.55,3.70,-6,M.stone);box(grounds,'upper-court',13,.55,18,9.55,4.18,-19,M.stone);box(grounds,'approach',5,.2,8,9.55,3.47,9,M.stone);root.add(grounds);root.updateMatrixWorld(true);return root;}
export function createPineContext(){const g=new THREE.Group();const spots=[[-.4,1.5,3.6],[3.7,2.0,3.8],[19.5,-5,4.0],[19,-12,4.1],[1.7,-8.1,4.1],[18,-19,4.3]];spots.forEach(([x,z,y],i)=>{const t=new THREE.Group();t.position.set(x,y,z);beam(t,'pine-trunk',[0,0,0],[.15,4.2,0],.045,M.dark);for(let j=0;j<4;j++){const angle=j*2.399+i,yy=1.7+j*.6,r=.7+(j%2)*.2;const end=[Math.cos(angle)*r,yy+.35,Math.sin(angle)*r];beam(t,'pine-branch',[0,yy,0],end,.023,M.dark);const foliage=new THREE.Mesh(new THREE.IcosahedronGeometry(.62,1),M.green);foliage.scale.set(1,.45,1);foliage.position.set(...end);foliage.castShadow=true;t.add(foliage)}g.add(t)});g.name='schematic-planting';return g;}
