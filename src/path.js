// Grid clearance and A* follow each map's dimensions, including the larger city.
export function findPath(s,x,y){
 const cell=.5,w=s.map.width*2+1,h=s.map.height*2+1,key=(x,y)=>x+y*w;
 const start={x:Math.round(s.x/cell),y:Math.round(s.y/cell)},goal={x:Math.round(x/cell),y:Math.round(y/cell)};
 const nav=s.world.navigation??=(()=>{const cells=new Uint8Array(w*h);for(let ny=0;ny<h;ny++)for(let nx=0;nx<w;nx++){const px=nx*cell,py=ny*cell;cells[key(nx,ny)]=!s.world.block(px,py)&&!s.world.block(px+.14,py)&&!s.world.block(px-.14,py)&&!s.world.block(px,py+.14)&&!s.world.block(px,py-.14)?1:0;}return cells;})();
 const clear=(nx,ny)=>nx>=0&&ny>=0&&nx<w&&ny<h&&nav[key(nx,ny)]===1;
 const candidates=[];for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const nx=goal.x+ox,ny=goal.y+oy;if(clear(nx,ny))candidates.push({x:nx,y:ny});}
 candidates.sort((a,b)=>Math.hypot(a.x*cell-x,a.y*cell-y)-Math.hypot(b.x*cell-x,b.y*cell-y));if(!candidates.length)return[];Object.assign(goal,candidates[0]);
 const cost=new Float64Array(w*h).fill(Infinity),parent=new Int32Array(w*h).fill(-1),closed=new Uint8Array(w*h),heap=[];
 function push(n){heap.push(n);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=n.score)break;heap[i]=heap[p];i=p;}heap[i]=n;}
 function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=last.score)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
 const first=key(start.x,start.y);cost[first]=0;push({...start,score:Math.hypot(start.x-goal.x,start.y-goal.y)});
 let end=-1;const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];
 while(heap.length){const n=pop(),id=key(n.x,n.y);if(closed[id])continue;closed[id]=1;if(n.x===goal.x&&n.y===goal.y){end=id;break;}
  for(const [dx,dy]of dirs){const nx=n.x+dx,ny=n.y+dy,k=key(nx,ny);if(!clear(nx,ny)||closed[k]||dx&&dy&&(!clear(n.x,ny)||!clear(nx,n.y)))continue;const next=cost[id]+Math.hypot(dx,dy);if(next>=cost[k])continue;cost[k]=next;parent[k]=id;push({x:nx,y:ny,score:next+Math.hypot(nx-goal.x,ny-goal.y)});}
 }
 if(end<0)return[];const route=[];for(let k=end;k!==first&&k>=0;k=parent[k])route.push({x:(k%w)*cell,y:Math.floor(k/w)*cell});return route.reverse();
}
