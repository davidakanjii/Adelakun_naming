const NETLIFY_API = 'https://api.netlify.com/api/v1';
function json(statusCode, body){return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
async function checkinStore(){const {getStore}=await import('@netlify/blobs');return getStore({name:'adelakun-checkins',consistency:'strong'})}
exports.handler=async(event)=>{
 const supplied=event.headers['x-admin-password']||'',expected=process.env.ADMIN_DASHBOARD_PASSWORD;
 if(!expected||supplied!==expected)return json(401,{error:'Unauthorised'});
 const token=process.env.NETLIFY_ACCESS_TOKEN,siteId=process.env.NETLIFY_SITE_ID;
 if(!token||!siteId)return json(500,{error:'Server configuration is incomplete. Check the three Netlify environment variables.'});
 try{
  if(event.httpMethod==='GET'){
   const response=await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}/submissions?per_page=1000`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
   if(!response.ok){console.error(await response.text());return json(502,{error:'Could not retrieve RSVP submissions from Netlify.'})}
   const submissions=await response.json();
   const store=await checkinStore();
   const rsvps=await Promise.all(submissions.filter(x=>String(x.form_name||x.data?.['form-name']||'').toLowerCase()==='rsvp').map(async x=>{const d=x.data||{};const legacyGuests=Number(d.guests||0);const hasBreakdown=d.adults!==undefined||d.children!==undefined;const adults=hasBreakdown?Number(d.adults||0):legacyGuests;const children=hasBreakdown?Number(d.children||0):0;const guests=hasBreakdown?adults+children:legacyGuests;const check=await store.get(`submission-${x.id}`,{type:'json',consistency:'strong'}).catch(()=>null);return{id:x.id,createdAt:x.created_at,name:d.name||'',attending:d.attending||'',adults,children,guests,phone:d.phone||'',guestNames:d.guest_names||'',dietaryRequirement:d.dietary_requirement||'None',dietaryDetails:d.dietary_details||'',message:d.message||'',reference:d.reservation_reference||'',privacyConsent:d.privacy_consent||'',checkedIn:!!check?.checkedIn,checkedInAt:check?.checkedInAt||null,checkinSource:check?.source||null}}));
   rsvps.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));return json(200,{submissions:rsvps});
  }
  if(event.httpMethod==='POST'){
   const body=JSON.parse(event.body||'{}');if(body.action!=='checkin'||!body.id)return json(400,{error:'A valid check-in request is required.'});
   const store=await checkinStore(),key=`submission-${body.id}`;
   if(body.checkedIn){const record={checkedIn:true,checkedInAt:new Date().toISOString(),source:body.source||'manual'};await store.setJSON(key,record);return json(200,record)}
   await store.delete(key);return json(200,{checkedIn:false,checkedInAt:null});
  }
  if(event.httpMethod==='DELETE'){
   const id=event.queryStringParameters?.id;if(!id)return json(400,{error:'Submission ID is required.'});
   const response=await fetch(`${NETLIFY_API}/submissions/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
   if(!response.ok){console.error(await response.text());return json(502,{error:'The RSVP could not be deleted from Netlify.'})}
   const store=await checkinStore();await store.delete(`submission-${id}`).catch(()=>{});return json(200,{ok:true});
  }
  return json(405,{error:'Method not allowed'});
 }catch(error){console.error(error);return json(500,{error:'Unexpected server error.'})}
};
