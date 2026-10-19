import {createHmac,timingSafeEqual} from 'node:crypto';

// pg_net may expose its extension-owned queue to database roles. Send only a
// short-lived signature there; the reusable worker credential stays in Vault.
export function validEmailWorkerAuthorization(header:string,secret:string,now=Date.now()):boolean {
 const match=/^Bearer v1\.(\d{10})\.([a-f0-9]{64})$/.exec(header);
 if(!match||Math.abs(Math.floor(now/1000)-Number(match[1]))>120)return false;
 const expected=createHmac('sha256',secret).update(match[1]).digest();
 return timingSafeEqual(expected,Buffer.from(match[2],'hex'));
}
