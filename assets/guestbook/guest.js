(() => {
  const api = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? '/api/guestbook' : 'https://rui-portfolio-2026.liaosirui3.chatgpt.site/api/guestbook';
  const form = document.querySelector('#guest-form');
  const status = document.querySelector('#status');
  const button = form.querySelector('button');
  const notes = document.querySelector('#notes');
  const more = document.querySelector('#more');
  let challenge;
  let highestZIndex = 1000;
  const colors = ['#B0E147', 'rgb(161, 213, 251)', '#E6E6E6', '#FFEA21', '#FCFFEB'];
  function place(card) {
    card.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    card.style.position = 'absolute';
    card.style.top = `${Math.floor(Math.random() * 60) + 20}%`;
    card.style.left = `${Math.floor(Math.random() * 70)}%`;
    card.addEventListener('click', () => {
      notes.querySelectorAll('.guest-item').forEach(item => item.style.zIndex = '');
      card.style.zIndex = ++highestZIndex;
    });
    requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      if (rect.right > document.documentElement.clientWidth - 12) card.style.left = `${Math.max(12, document.documentElement.clientWidth - rect.width - 12)}px`;
    });
  }
  const time = () => document.querySelector('#time').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  time(); setInterval(time,60000);
  async function request(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not connect. Please try again.');
    return data;
  }
  async function getChallenge() {
    challenge = await request(api + '/challenge');
    document.querySelector('#question').textContent = challenge.question;
    button.disabled = false;
  }
  function render(items) {
    for (const item of items) {
      const card = document.createElement('article');card.className='guest-item';
      const name = document.createElement('span'); name.className='guest-xinming'; name.textContent=item.name;
      const date = document.createElement('time'); date.className='guest-timestamp'; date.dateTime=new Date(item.created_at).toISOString();
      date.textContent=new Date(item.created_at).toLocaleString([], {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      const message = document.createElement('div');message.className='guest-liuyan';message.textContent=item.message;
      const timestamp=document.createElement('span');timestamp.className='guest-timestamp';timestamp.append(date);
      card.append(name,document.createTextNode(' '),timestamp,message);notes.append(card);place(card);
    }
  }
  async function load(reset=false) {
    const data=await request(api);
    notes.replaceChildren();
    render(data.entries.slice(0,10));more.hidden=true;
    if(!notes.children.length) {
      const card=document.createElement('div');card.className='guest-item';
      const title=document.createElement('span');title.className='guest-xinming';title.textContent='Guestbook';
      const text=document.createElement('div');text.className='guest-liuyan';text.textContent='No content.';
      card.append(title,text);notes.append(card);place(card);
    }
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!challenge)return;button.disabled=true;status.textContent='sending…';
    const data=new FormData(form);
    try {
      await request(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:data.get('xinming'),message:data.get('liuyan'),website:data.get('website'),answer:Number(data.get('math')),token:challenge.token})});
      form.reset();status.textContent='sent! thank you ~';await load(true);
    } catch(error){status.textContent=error.message;}
    finally {try{await getChallenge();}catch{status.textContent+=' Please reload to try again.';}}
  });
  Promise.all([getChallenge(),load(true)]).catch(error=>{status.textContent=error.message;});
})();
