import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
from pywinauto import Desktop
import io
import sys
import threading

class UISpyApp:
    def __init__(self, root):
        self.root = root
        self.root.title("🕵️‍♂️ Python UI Spy (by Antigravity)")
        self.root.geometry("900x600")
        self.root.configure(bg="#F0F4F4")

        # Styling
        style = ttk.Style()
        style.theme_use('clam')
        style.configure("TButton", padding=6, relief="flat", background="#0EA5E9", foreground="white", font=('Segoe UI', 10, 'bold'))
        style.map("TButton", background=[('active', '#0284C7')])
        style.configure("TCombobox", padding=5, font=('Segoe UI', 10))
        style.configure("TLabel", background="#F0F4F4", font=('Segoe UI', 10))

        # --- Top Frame: Window Selection ---
        top_frame = tk.Frame(root, bg="#F0F4F4", pady=15, padx=15)
        top_frame.pack(fill=tk.X)

        ttk.Label(top_frame, text="1. เลือกหน้าต่างโปรแกรมที่ต้องการส่อง:").pack(side=tk.LEFT, padx=(0, 10))

        self.window_combo = ttk.Combobox(top_frame, width=50, state="readonly")
        self.window_combo.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_refresh = ttk.Button(top_frame, text="🔄 รีเฟรชรายชื่อ", command=self.refresh_windows)
        self.btn_refresh.pack(side=tk.LEFT, padx=(0, 10))

        self.btn_inspect = ttk.Button(top_frame, text="🔍 สแกนโครงสร้าง (Inspect)", command=self.start_inspection)
        self.btn_inspect.pack(side=tk.LEFT)

        # --- Middle Frame: Control Backend ---
        mid_frame = tk.Frame(root, bg="#F0F4F4", pady=5, padx=15)
        mid_frame.pack(fill=tk.X)
        ttk.Label(mid_frame, text="โหมดการสแกน:").pack(side=tk.LEFT, padx=(0, 5))
        self.backend_var = tk.StringVar(value="win32")
        ttk.Radiobutton(mid_frame, text="Legacy (win32) - แนะนำสำหรับ BIS", variable=self.backend_var, value="win32").pack(side=tk.LEFT, padx=5)
        ttk.Radiobutton(mid_frame, text="Modern (uia) - โปรแกรมรุ่นใหม่", variable=self.backend_var, value="uia").pack(side=tk.LEFT, padx=5)

        # --- Bottom Frame: Output Text Area ---
        bottom_frame = tk.Frame(root, bg="#F0F4F4", padx=15, pady=15)
        bottom_frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(bottom_frame, text="2. โครงสร้างกระดูกหลังบ้าน (UI Tree):", font=('Segoe UI', 10, 'bold')).pack(anchor=tk.W, pady=(0, 5))

        self.txt_output = scrolledtext.ScrolledText(bottom_frame, wrap=tk.NONE, font=('Consolas', 10), bg="#1E293B", fg="#38BDF8")
        self.txt_output.pack(fill=tk.BOTH, expand=True)

        # Scrollbars for text area
        x_scroll = ttk.Scrollbar(self.txt_output, orient='horizontal', command=self.txt_output.xview)
        x_scroll.pack(side=tk.BOTTOM, fill=tk.X)
        self.txt_output['xscrollcommand'] = x_scroll.set

        # Status Bar
        self.status_var = tk.StringVar()
        self.status_var.set("พร้อมใช้งาน... ให้กดปุ่ม 'รีเฟรชรายชื่อ' เพื่อเริ่มต้น")
        status_bar = ttk.Label(root, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W, padding=5, background="#E2E8F0")
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        self.windows_cache = []
        self.refresh_windows()

    def refresh_windows(self):
        self.status_var.set("⏳ กำลังดึงรายชื่อหน้าต่าง...")
        self.root.update()
        
        try:
            # ดึงรายชื่อหน้าต่างทั้งหมด
            desktop = Desktop(backend="win32")
            all_windows = desktop.windows(visible_only=True)
            
            self.windows_cache = []
            display_names = []
            
            for w in all_windows:
                title = w.window_text()
                if title.strip(): # เอาเฉพาะหน้าต่างที่มีชื่อ
                    self.windows_cache.append(w)
                    display_names.append(f"[{w.handle}] {title}")
            
            self.window_combo['values'] = display_names
            if display_names:
                self.window_combo.current(0)
                self.status_var.set(f"✅ พบหน้าต่างทั้งหมด {len(display_names)} รายการ")
            else:
                self.status_var.set("⚠️ ไม่พบหน้าต่างใดๆ")
                
        except Exception as e:
            messagebox.showerror("Error", f"ดึงชื่อหน้าต่างล้มเหลว: {e}")
            self.status_var.set("❌ เกิดข้อผิดพลาด")

    def start_inspection(self):
        idx = self.window_combo.current()
        if idx == -1:
            messagebox.showwarning("Warning", "กรุณาเลือกหน้าต่างก่อนกดสแกนครับ!")
            return

        target_handle = self.windows_cache[idx].handle
        backend_type = self.backend_var.get()
        
        self.btn_inspect.config(state=tk.DISABLED)
        self.txt_output.delete(1.0, tk.END)
        self.txt_output.insert(tk.END, f"⏳ กำลังสแกนโครงสร้างหน้าต่าง (ใช้เวลา 5-20 วินาที)...\n")
        self.txt_output.insert(tk.END, f"⚙️ โหมดที่ใช้สแกน: {backend_type.upper()}\n")
        self.txt_output.insert(tk.END, "โปรดรอซักครู่ โปรแกรมอาจจะดูเหมือนค้าง (Not Responding) เป็นเรื่องปกตินะครับ...\n\n")
        
        self.status_var.set("⏳ กำลังสแกน... กรุณารอสักครู่ (ห้ามคลิกปิดโปรแกรม)")
        self.root.update()

        # Run UI inspection in a separate thread so GUI doesn't freeze permanently 
        thread = threading.Thread(target=self._inspect_worker, args=(target_handle, backend_type))
        thread.daemon = True
        thread.start()

    def _inspect_worker(self, handle, backend_type):
        try:
            # ใช้ Redirect Standard Output ของ Python เก็บผลลัพธ์
            output_buffer = io.StringIO()
            old_stdout = sys.stdout
            sys.stdout = output_buffer

            desktop = Desktop(backend=backend_type)
            app_window = desktop.window(handle=handle)
            
            # สแกนความลึกแค่ระดับ 5 ก่อน กันโปรแกรมหยุดทำงาน
            app_window.print_control_identifiers(depth=7)
            
            # คืนค่าหน้าจอให้เหมือนเดิม
            sys.stdout = old_stdout
            result_text = output_buffer.getvalue()
            output_buffer.close()

            # อัปเดต GUI (ต้องสั่งผ่าน thread หลักเท่านั้นใน tkinter แต่อันนี้อนุโลมแบบง่ายๆ)
            self.root.after(0, self._update_inspection_result, result_text, True, "")
            
        except Exception as e:
            sys.stdout = old_stdout
            self.root.after(0, self._update_inspection_result, "", False, str(e))

    def _update_inspection_result(self, text, success, error_msg):
        self.btn_inspect.config(state=tk.NORMAL)
        if success:
            self.txt_output.insert(tk.END, text)
            self.status_var.set("🎉 สแกนเสร็จสมบูรณ์! คุณสามารถคลุมดำและกด Ctrl+C เพื่อก็อปปี้ข้อมูลได้เลย")
        else:
            self.txt_output.insert(tk.END, f"\n❌ เกิดข้อผิดพลาด ล็อกโครงสร้างไม่สำเร็จ:\n{error_msg}")
            self.txt_output.insert(tk.END, "\n\n💡 คำแนะนำ: ลองสลับ 'โหมดการสแกน' เป็นอีกแบบ แล้วกดสแกนใหม่ดูครับ")
            self.status_var.set("❌ การสแกนล้มเหลว")

if __name__ == "__main__":
    root = tk.Tk()
    app = UISpyApp(root)
    root.mainloop()

