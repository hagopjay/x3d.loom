// Spark pool for the bindu and struck chambers. Each slot carries a launch
// record; its pose is a closed-form function of time (drag-damped ballistic
// flight, shrinking gem), so sampling is deterministic and allocation-free.
export class SparkPool{
  constructor(count=60,{life=1.6,speed=1.25,size=.05}={}){this.count=count;this.life=life;this.speed=speed;this.size=size;this.slots=Array.from({length:count},()=>null);this.next=0;this.out=Array.from({length:count},()=>[0,0,0,0]);this.launched=0;}
  burst(x,y,n,t,{speed=this.speed,seed=this.launched}={}){
    for(let i=0;i<n;i++){const r=Math.sin((seed+i)*12.9898)*43758.5453,u=r-Math.floor(r),q=Math.sin((seed+i)*78.233)*12345.678,w=q-Math.floor(q);
      const a=(i/n+u*.35)*Math.PI*2,v=speed*(.45+.75*w);
      this.slots[this.next]={x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t0:t,life:this.life*(.6+.6*u),size:this.size*(.6+.8*w),spin:u*9};
      this.next=(this.next+1)%this.count;this.launched++;}
  }
  sample(t){let live=0;
    for(let i=0;i<this.count;i++){const s=this.slots[i],o=this.out[i];
      if(!s){o[2]=0;continue;}const a=t-s.t0;if(a<0||a>s.life){o[2]=0;if(a>s.life)this.slots[i]=null;continue;}
      const drag=2.2,d=(1-Math.exp(-drag*a))/drag;o[0]=s.x+s.vx*d;o[1]=s.y+s.vy*d-.12*a*a;o[2]=s.size*Math.pow(1-a/s.life,.7);o[3]=s.spin+a*4;live++;}
    this.live=live;return this.out;}
}
