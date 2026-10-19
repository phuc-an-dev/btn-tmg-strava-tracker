export function PortalSkeleton({compact=false}:{compact?:boolean}) {
 return <div className="portal-skeleton" role="status" aria-label="Đang tải dữ liệu" aria-busy="true">{[1,2,3].slice(0,compact?2:3).map(id=><div className="skeleton-row" key={id}><span/><div><i/><i/></div></div>)}</div>;
}
