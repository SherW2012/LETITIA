"""Geometry-only owner association. Loss is latched until explicit calibration."""
def overlap(a, b):
    area=max(0,min(a['x']+a['w'],b['x']+b['w'])-max(a['x'],b['x']))*max(0,min(a['y']+a['h'],b['y']+b['h'])-max(a['y'],b['y']))
    return area/max(1e-9,a['w']*a['h']+b['w']*b['h']-area)

class Guard:
    def __init__(self):
        self.reset()
    def reset(self):
        self.owner=None
        self.last_owner=0
        self.suspect=None
        self.hits=0
        self.clear=None
        self.cover=False
        self.lost=False
    def calibrate(self,box,now):
        self.reset()
        self.owner=dict(box)
        self.last_owner=now
    def update(self,people,now,clear_seconds=3):
        own=-1
        if self.owner is None:
            return own,False,False
        if not self.lost:
            ranked=sorted([(overlap(p,self.owner),i) for i,p in enumerate(people) if 0.6<p['w']*p['h']/(self.owner['w']*self.owner['h'])<1.65],reverse=True)
            if ranked and ranked[0][0]>.4 and (len(ranked)<2 or ranked[0][0]-ranked[1][0]>.12):
                own=ranked[0][1]
                self.owner=dict(people[own])
                self.last_owner=now
            elif now-self.last_owner>1.2:
                self.lost=True
        if len(people)-(1 if own>=0 else 0)>0 or self.lost:
            self.clear=None
            if self.suspect is None: self.suspect=now
            self.hits+=1
            if self.lost or (self.hits>=2 and now-self.suspect>=.15): self.cover=True
        else:
            self.suspect=None
            self.hits=0
            if own>=0:
                if self.clear is None: self.clear=now
                if now-self.clear>=clear_seconds: self.cover=False
            else: self.clear=None
        return own,self.cover,self.lost
