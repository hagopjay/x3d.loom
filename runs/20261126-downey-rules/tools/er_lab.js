function pc(n, p){var q=1-p,P=[0,1];for(var m=2;m<=n;m++){var s=0,c=1;for(var k=1;k<m;k++){s+=c*P[k]*Math.pow(q,k*(m-k));c=c*(m-1-(k-1))/k;}P.push(1-s);}return P[n];}
var res={};
for (var n=3;n<=60;n++){var bad=0,worst=0,lastbad=null;for(var k=0;k<=120;k++){var q=Math.pow(10,-2.5+2.5*k/120);var v=pc(n,q);if(v<-1e-3||v>1+1e-3){bad++;lastbad=q;}worst=Math.max(worst,Math.abs(v));}if(bad)res[n]={bad:bad,worst:worst,lastbad:lastbad};}
console.log(process.version, JSON.stringify(res));
