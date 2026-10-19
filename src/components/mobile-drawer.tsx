"use client";

import { SelectItem } from "./select-item";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronDown, X } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";

const subscribe = (callback: () => void) => {
  const media = window.matchMedia("(max-width: 639px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
export function useMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 639px)").matches, () => false);
}

export function BottomDrawer({ open, onOpenChange, title, description, children, footer, busy = false, className = "", headingAction }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode | false; busy?: boolean; className?: string; headingAction?: ReactNode;
}) {
  const details=<Drawer.Description className={description ? "drawer-description" : "sr-only"}>{description || "Vuốt xuống hoặc nhấn đóng để quay lại."}</Drawer.Description>;
  return <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="down"><Drawer.VirtualKeyboardProvider><Drawer.Portal><Drawer.Backdrop className="drawer-backdrop"/><Drawer.Viewport className="drawer-viewport"><Drawer.Popup className={`bottom-drawer ${className}`.trim()} initialFocus={false}><div className="drawer-handle" aria-hidden="true"/><Drawer.Content className="drawer-content"><header className="drawer-heading"><div><Drawer.Title>{title}</Drawer.Title>{headingAction?<div className="drawer-description-row">{details}{headingAction}</div>:details}</div><Drawer.Close className="drawer-close" disabled={busy} aria-label={`Đóng ${title}`}><X size={18}/></Drawer.Close></header>{children}{footer !== false && <footer className="drawer-footer drawer-actions"><button type="button" className="drawer-cancel" disabled={busy} onClick={()=>onOpenChange(false)}>Hủy</button>{footer}</footer>}</Drawer.Content></Drawer.Popup></Drawer.Viewport></Drawer.Portal></Drawer.VirtualKeyboardProvider></Drawer.Root>;
}

export type PickerOption = { value: string; label: string; group?: string; childLabel?: string };
export function ResponsivePicker({ label, options, value, defaultValue = "", onChange, name, id, disabled, className = "", triggerLabel }: {
  label: string; options: PickerOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void;
  name?: string; id?: string; disabled?: boolean; className?: string; triggerLabel?: string;
}) {
  const mobile = useMobile();
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = value ?? internal;
  const [draft, setDraft] = useState(selected);
  const change = (next: string) => { setInternal(next); onChange?.(next); };
  const optionGroups = Array.from(new Set(options.map(option=>option.group).filter(Boolean)));
  const renderOption = (option: PickerOption, branch = false) => <SelectItem key={option.value} label={branch ? option.childLabel || option.label : option.label} accessibleLabel={option.label} selected={option.value===draft} onSelect={()=>setDraft(option.value)} className={branch ? "drawer-tree-option" : ""}/>;
  if (!mobile) return <select id={id} name={name} aria-label={label} className={className} disabled={disabled} value={selected} onChange={event=>change(event.target.value)}>{options.filter(option=>!option.group).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}{Array.from(new Set(options.map(option=>option.group).filter(Boolean))).map(group=><optgroup key={group} label={group}>{options.filter(option=>option.group===group).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>)}</select>;
  return <div className={`responsive-picker ${className}`}>{name && <input type="hidden" name={name} value={selected} disabled={disabled}/>}<button id={id} type="button" className="picker-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>{setDraft(selected);setOpen(true);}}><span>{triggerLabel || options.find(option=>option.value===selected)?.label || "Chọn…"}</span><ChevronDown size={18}/></button><BottomDrawer open={open} onOpenChange={setOpen} title={label} footer={<button type="button" className="primary" onClick={()=>{change(draft);setOpen(false);}}>Xác nhận</button>}><div className="drawer-options" role="listbox" aria-label={label} data-base-ui-swipe-ignore>{options.filter(option=>!option.group).map(option=>renderOption(option))}{optionGroups.map(group=><section className="drawer-tree-branch" role="group" aria-label={group} key={group}><h3 className="drawer-tree-heading">{group}</h3><div className="drawer-tree-children">{options.filter(option=>option.group===group).map(option=>renderOption(option,true))}</div></section>)}</div></BottomDrawer></div>;
}

export function ChoiceEditor({ title, value, options, busy, onSave, error }: {
  title: string; value: string; options: PickerOption[]; busy: boolean; onSave: (value: string) => Promise<boolean>; error: string;
}) {
  const mobile = useMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const form = <form className={mobile ? "drawer-form" : "choice-editor"} onSubmit={async event=>{event.preventDefault();if(await onSave(draft)) setOpen(false);}}><div className="drawer-form-body" data-base-ui-swipe-ignore><ResponsivePicker label={title} options={options} value={draft} onChange={setDraft} disabled={busy}/>{mobile && error && <p role="alert" className="drawer-error">{error}</p>}</div><footer className={mobile ? "drawer-footer drawer-actions" : ""}>{mobile && <button type="button" className="drawer-cancel" disabled={busy} onClick={()=>setOpen(false)}>Hủy</button>}<button className="primary" disabled={busy}>{busy ? "Đang lưu…" : mobile ? "Xác nhận" : "Lưu"}</button></footer></form>;
  if (!mobile) return form;
  return <><button type="button" className="text-button" disabled={busy} onClick={()=>{setDraft(value);setOpen(true);}}>{title}</button><BottomDrawer open={open} onOpenChange={next=>{if(!busy) setOpen(next);}} title={title} footer={false} busy={busy}>{form}</BottomDrawer></>;
}
