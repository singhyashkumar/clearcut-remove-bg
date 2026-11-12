export function setupLoginReports({doc,apiBase,getUser,getToken}) {
 const parent=doc.getElementById('account-control');
 const button=doc.createElement('button');button.type='button';button.className='text-button';button.textContent='Login report';
 const panel=doc.createElement('section');panel.hidden=true;panel.className='login-report';panel.setAttribute('aria-label','Your login report');
 const heading=doc.createElement('h2');heading.textContent='Your login report';
 const status=doc.createElement('p');status.setAttribute('role','status');
 const list=doc.createElement('ul');
 const close=doc.createElement('button');close.type='button';close.className='secondary';close.textContent='Close login report';
 panel.append(heading,status,list,close);parent.append(button);doc.querySelector('main').prepend(panel);
 let generation=0,sessionUser=null;
 const reset=user=>{generation++;sessionUser=user?.uid||null;panel.hidden=true;list.replaceChildren();status.textContent='';button.disabled=!user||!apiBase;};
 close.onclick=()=>{panel.hidden=true;button.focus();};
 button.onclick=async()=>{
  const user=getUser();if(!user)return;
  const revision=++generation,uid=user.uid;
  panel.hidden=false;status.textContent='Loading your recent sign-ins…';list.replaceChildren();
  try {
   const token=await getToken();
   if(revision!==generation||uid!==getUser()?.uid)return;
   const response=await fetch(`${apiBase.replace(/\/$/,'')}/api/security-report`,{headers:{authorization:`Bearer ${token}`}});
   if(!response.ok)throw Error();
   const data=await response.json();
   if(revision!==generation||uid!==getUser()?.uid)return;
   status.textContent='Verified Google sessions first seen by Clearcut in the last 30 days. Refreshes are not new logins. Google popup failures and sign-outs are not included.';
   for(const entry of data.sessions||[]) {
    const item=doc.createElement('li');
    item.textContent=`Google sign-in: ${new Date(entry.auth_time*1000).toLocaleString()} · First seen here: ${new Date(entry.first_seen_at*1000).toLocaleString()}`;
    list.append(item);
   }
   if(!data.sessions?.length)status.textContent+=' No sessions recorded yet.';
  } catch {if(revision===generation)status.textContent='Your login report is unavailable. Please try again later.';}
 };
 reset(getUser());
 return user=>{if((user?.uid||null)!==sessionUser)reset(user);};
}
