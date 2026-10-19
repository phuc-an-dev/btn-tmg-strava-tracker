export type SignupMember={strava_athlete_id:number;strava_name:string;division_id:number|null;group_id:number|null};
export type SignupGroup={id:number;name:string;division_id:number};
export type SignupOptions={members:SignupMember[];total:number;groups:SignupGroup[]};
export type SignupSelection={groupId:number|null;athleteId:number|null;profileUrl:string};
export const emptySignupSelection:SignupSelection={groupId:null,athleteId:null,profileUrl:""};
export function stravaProfileId(value:string):number|null {
 try {const url=new URL(value.trim());const match=url.pathname.match(/^\/athletes\/([1-9]\d{0,14})\/?$/);return url.protocol==="https:"&&["www.strava.com","strava.com"].includes(url.hostname)&&!url.username&&!url.password&&!url.port&&match?Number(match[1]):null;}catch{return null;}
}
export const stravaProfileUrl=(id:number)=>`https://www.strava.com/athletes/${id}`;
