(() => {
  const size = image => {
    const width=image.closest('.slideshow-container')?.getBoundingClientRect().width || image.parentElement?.getBoundingClientRect().width || document.documentElement.clientWidth;
    image.sizes=Math.ceil(width)+'px';
  };
  const transfer = element => {
    if(element.dataset.srcset){size(element);element.srcset=element.dataset.srcset;delete element.dataset.srcset;}
    if(element.dataset.src){element.src=element.dataset.src;delete element.dataset.src;return true;}return false;
  };
  const command=(frame,method,value)=>frame.contentWindow?.postMessage(JSON.stringify({method,value}),'https://player.vimeo.com');
  const play=element=>{
    if(element.tagName==='IFRAME'){command(element,'setMuted',true);command(element,'setVolume',0);command(element,'setLoop',true);command(element,'play');}
    else{element.muted=true;element.loop=true;element.playsInline=true;element.play().catch(()=>{});}
  };
  const visiblePlayers=new Set();
  window.addEventListener('message',event=>{
    if(event.origin!=='https://player.vimeo.com')return;let data=event.data;
    try{if(typeof data==='string')data=JSON.parse(data);}catch{return;}
    if(data?.event!=='ready')return;
    for(const frame of visiblePlayers)if(frame.tagName==='IFRAME'&&frame.contentWindow===event.source)play(frame);
  });
  const playback=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(isIntersecting&&!document.hidden){visiblePlayers.add(target);play(target);}
      else{visiblePlayers.delete(target);if(target.tagName==='IFRAME')command(target,'pause');else target.pause();}
    }
  },{threshold:.15});
  const loader=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(!isIntersecting)continue;
      if(target.tagName==='VIDEO'){target.querySelectorAll('source[data-src]').forEach(transfer);transfer(target);target.load();playback.observe(target);}
      else{transfer(target);if(target.tagName==='IFRAME'){target.addEventListener('load',()=>{if(visiblePlayers.has(target))play(target);});playback.observe(target);}}
      loader.unobserve(target);
    }
  },{rootMargin:'250px 0px'});
  document.querySelectorAll('img[data-src],video,iframe[data-vimeo]').forEach(element=>loader.observe(element));
  window.addEventListener('resize',()=>document.querySelectorAll('img[srcset]').forEach(size));
  document.addEventListener('visibilitychange',()=>{for(const player of visiblePlayers){if(!document.hidden)play(player);else if(player.tagName==='IFRAME')command(player,'pause');else player.pause();}});
})();
