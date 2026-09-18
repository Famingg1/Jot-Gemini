(function(root){
  function shape(level,count=11){level=Math.max(0,Math.min(1,Number(level)||0));return Array.from({length:count},(_,i)=>{const distance=count<=1?0:Math.abs(i-(count-1)/2)/((count-1)/2);const amplitude=Math.pow(Math.max(0,(level-distance*.55)/(1-distance*.55)),.7);return .1+amplitude*.9*(1-distance*.32);});}
  const api={shape};if(typeof module!=='undefined')module.exports=api;else root.TakkieWave=api;
})(globalThis);
