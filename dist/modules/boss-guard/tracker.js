// Position tracking, not face recognition. Lost/ambiguous owner => cover until recalibrated.
export function overlap(a, b) {
  const area = Math.max(0, Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) * Math.max(0, Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return area / Math.max(1e-9, a.w*a.h+b.w*b.h-area);
}
export class Guard {
  constructor({threshold = 0.5, clearMs = 3000} = {}) { this.threshold=threshold; this.clearMs=clearMs; this.reset(); }
  reset() { this.owner=null; this.lastOwnerAt=0; this.suspectAt=null; this.hits=0; this.clearAt=null; this.cover=false; this.lost=false; }
  calibrate(box, now) { this.reset(); this.owner={...box}; this.lastOwnerAt=now; }
  update(input, now) {
    const people=input.filter(p=>p.score>=this.threshold);
    if (!this.owner) return {people, ownerIndex:-1, state:'setup', cover:false};
    let ownerIndex=-1;
    if (!this.lost) {
      const ranked=people.map((p,i)=>({i,match:overlap(p,this.owner),ratio:p.w*p.h/(this.owner.w*this.owner.h)}))
        .filter(p=>p.match>0.4 && p.ratio>0.6 && p.ratio<1.65).sort((a,b)=>b.match-a.match);
      if (ranked.length && (!ranked[1] || ranked[0].match-ranked[1].match>0.12)) ownerIndex=ranked[0].i;
      if(ownerIndex>=0) { this.owner={...people[ownerIndex]}; this.lastOwnerAt=now; }
      else if(now-this.lastOwnerAt>1200) this.lost=true;
    }
    const other=people.length-(ownerIndex>=0?1:0);
    if(other>0 || this.lost) {
      this.clearAt=null;
      this.suspectAt??=now; this.hits++;
      if(this.lost || (this.hits>=2 && now-this.suspectAt>=150)) this.cover=true;
    } else {
      this.suspectAt=null; this.hits=0;
      // A missing owner is never evidence that the room is clear.
      if(ownerIndex>=0) { this.clearAt??=now; if(now-this.clearAt>=this.clearMs) this.cover=false; }
      else this.clearAt=null;
    }
    return {people,ownerIndex,other,cover:this.cover,state:this.lost?'lost':this.cover?'covered':other?'confirming':'watching'};
  }
}
