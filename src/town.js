import {TOWN} from './data.js';
const f=TOWN.fence,g=TOWN.gate;
export const fenceEdges=[
 [{x:f.left,y:f.top},{x:g.x-f.gap,y:f.top}],
 [{x:g.x+f.gap,y:f.top},{x:f.right,y:f.top}],
 [{x:f.right,y:f.top},{x:f.right,y:f.bottom}],
 [{x:f.right,y:f.bottom},{x:f.left,y:f.bottom}],
 [{x:f.left,y:f.bottom},{x:f.left,y:f.top}]
];
function segmentDistance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
export function townBoundaryBlocked(x,y){
 const corridor=Math.abs(x-g.x)<f.gap-.5&&y>f.top-1.5&&y<f.top+1;
 if((x<f.left||x>f.right||y<f.top||y>f.bottom)&&!corridor)return true;
 return fenceEdges.some(([a,b])=>segmentDistance(x,y,a,b)<.52);
}
export function atTownGate(x,y){return Math.abs(x-g.x)<1.9&&y<f.top-.85;}
export function fencePanels(){const panels=[];for(const[a,b]of fenceEdges){const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/1.6);for(let i=0;i<n;i++){const from={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},to={x:a.x+(b.x-a.x)*(i+1)/n,y:a.y+(b.y-a.y)*(i+1)/n};panels.push({kind:'fence',x:(from.x+to.x)/2,y:(from.y+to.y)/2,from,to,radius:0,scale:1});}}return panels;}
