const NETLIFY_API = 'https://api.netlify.com/api/v1';
function json(statusCode, body){return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)}}
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
   const rsvps=submissions.filter(x=>String(x.form_name||x.data?.['form-name']||'').toLowerCase()==='rsvp').map(x=>{const d=x.data||{};return{id:x.id,createdAt:x.created_at,name:d.name||'',attending:d.attending||'',guests:Number(d.guests||0),phone:d.phone||'',message:d.message||''}}).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
   return json(200,{submissions:rsvps});
  }
  if(event.httpMethod==='DELETE'){
   const id=event.queryStringParameters?.id;if(!id)return json(400,{error:'Submission ID is required.'});
   const response=await fetch(`${NETLIFY_API}/submissions/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
   if(!response.ok){console.error(await response.text());return json(502,{error:'The RSVP could not be deleted from Netlify.'})}
   return json(200,{ok:true});
  }
  return json(405,{error:'Method not allowed'});
 }catch(error){console.error(error);return json(500,{error:'Unexpected server error.'})}
};
