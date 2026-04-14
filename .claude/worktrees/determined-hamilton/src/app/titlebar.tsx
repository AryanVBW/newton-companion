function Titlebar() {
  return (
    <div
      data-tauri-drag-region
      className="h-[52px] flex items-center px-4 select-none shrink-0"
    >
      {/* Traffic lights area - macOS window controls sit here */}
      <div className="w-[70px]" data-tauri-drag-region />
    </div>
  )
}

export { Titlebar }
