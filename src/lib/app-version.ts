export const appVersion=process.env.NEXT_PUBLIC_APP_VERSION??'development';

export function isAppVersion(value:unknown):value is string {
 return typeof value==='string'&&/^[a-f0-9]{12}$/.test(value);
}

export function mayRetryUpdate(attempt:{from:string;to:string;at:number}|null,from:string,to:string,now:number,manual=false) {
 return !attempt||attempt.from!==from||attempt.to!==to||(manual&&now-attempt.at>60_000);
}
