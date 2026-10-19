"use client";
import {useSyncExternalStore} from "react";
import {Share,Smartphone} from "lucide-react";

function subscribe(onChange:()=>void) {
  const media=window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change",onChange);
  return ()=>media.removeEventListener("change",onChange);
}

function shouldShow() {
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  const standalone=window.matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone;
  return ios&&!standalone;
}

export function InstallHomeScreenGuide() {
  const visible=useSyncExternalStore(subscribe,shouldShow,()=>false);
  if(!visible)return null;
  return <details className="install-home-screen-guide">
    <summary><Smartphone size={17}/>Dùng REVIVE như ứng dụng</summary>
    <ol>
      <li>Mở website REVIVE trong Safari.</li>
      <li>Nhấn <Share size={14} aria-hidden="true"/> Chia sẻ → Thêm vào Màn hình chính.</li>
      <li>Nếu có mục “Mở dưới dạng ứng dụng”, bật mục này rồi nhấn Thêm.</li>
      <li>Mở REVIVE bằng icon vừa thêm và đăng nhập.</li>
    </ol>
  </details>;
}
