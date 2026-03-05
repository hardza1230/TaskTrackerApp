import time
from datetime import datetime, timedelta
import pyautogui
import pyperclip
from pywinauto import Desktop
import pytesseract
from PIL import Image
import re

# --- ตั้งค่าตัวแปรหลัก ---
APP_TITLE = "Business Intelligence"
PASSWORD = "pln"

# กำหนด Path ให้ Tesseract (ถ้าไม่ได้อยู่บน Windows Environment Variables)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# ฟังก์ชันช่วยเหลือสำหรับหางานด้วย OCR (ใช้ Pytesseract)
def click_text_ocr(target_text, threshold=0.5, timeout=15, name="ข้อความ", double_click=False, offset_x=0):
    print(f"กำลังค้นหา (OCR): '{target_text}' ({name})...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        # ถ่ายภาพหน้าจอแบบเต็มจอ
        screenshot = pyautogui.screenshot()
        
        # ค้นหาข้อความและพิกัดในภาพ (ลดความยุ่งยากด้วย OCR)
        # config='--psm 11' (Sparse text. Find as much text as possible in no particular order)
        try:
            data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT, lang='eng')
        except pytesseract.TesseractNotFoundError:
            print("❌ ไม่พบโปรแกรม Tesseract OCR! กรุณาติดตั้ง Tesseract-OCR ก่อนใช้งาน")
            return False
            
        n_boxes = len(data['text'])
        for i in range(n_boxes):
            # ดูเฉพาะที่ confidence เกินขั้นต่ำ 
            if int(data['conf'][i]) >= (threshold * 100):
                text = data['text'][i].strip()
                # ใช้วิธี re.search แบบง่ายเพื่อแก้ปัญหาเรื่อง case sensitive
                if re.search(re.escape(target_text), text, re.IGNORECASE):
                    print(f"✅ พบ '{text}' (มั่นใจ {data['conf'][i]}%)")
                    
                    (x, y, w, h) = (data['left'][i], data['top'][i], data['width'][i], data['height'][i])
                    center_x = int(x + w / 2) + offset_x
                    center_y = int(y + h / 2)
                    
                    # เอาเมาส์ไปคลิก
                    pyautogui.moveTo(center_x, center_y, duration=0.5)
                    if double_click:
                        pyautogui.doubleClick()
                    else:
                        pyautogui.click()
                        
                    print(f"🖱️ คลิกลงบนพิกัด ({center_x}, {center_y}) สำเร็จ")
                    time.sleep(1) # รอโปรแกรมตอบสนอง
                    return True
                
        time.sleep(1) # รอ 1 วิแล้วสแกนหน้าจอใหม่
        
    print(f"❌ หางานไม่เจอ: '{target_text}' (สแกนเกิน {timeout} วินาที)")
    return False

def automate_bis():
    print("เริ่มการรันบอท BIS Automation (เปิดระบบ OCR ด้วย Tesseract)...")
    
    # 1. ยึดหน้าต่างโปรแกรมให้อยู่หน้าสุด (Maximize)
    try:
        desktop = Desktop(backend="win32")
        windows = desktop.windows(visible_only=True)
        target_windows = [w for w in windows if APP_TITLE.lower() in w.window_text().lower()]
        
        if not target_windows:
            print("❌ เปิดโปรแกรม BIS ขึ้นมาก่อนครับ!")
            return
            
        app_window = target_windows[0]
        app_window.set_focus()
        print("✅ ล็อกเป้าหน้าต่างสำเร็จ")
        time.sleep(1)
    except Exception as e:
        print(f"เกิดข้อผิดพลาดในการดึงหน้าต่าง: {e}")
        return

    # 2. พิมพ์ Password และกด Enter
    print("กำลังพิมพ Password...")
    pyautogui.write(PASSWORD)
    pyautogui.press('enter')
    
    # 3. รอโหลด 5 วินาที
    print("⏳ รอโปรแกรมโหลดข้อมูล 5 วินาที...")
    time.sleep(5)
    
    # ========================================================
    
    # 4. กดเลือก Server จาก Tree Menu (Syteline-SK -> SRCPSKDB1 -> Planning -> SAM_FG)
    print("กำลังไล่เปิดโฟลเดอร์ Server...")
    
    # ทะลวงต้นไม้ด้วย OCR (ใช้ Double Click เพื่อเปิดโฟลเดอร์)
    if click_text_ocr('Syteline', name="เมนู Syteline", double_click=True):
        time.sleep(1) 
        
    if click_text_ocr('SRCPSKDB1', name="เมนู SRCPSKDB1", double_click=True):
        time.sleep(1)
        
    if click_text_ocr('Planning', name="เมนู Planning", double_click=True):
        time.sleep(1)
        
    # ค้นหา SAM_FG แล้วดับเบิ้ลคลิกเพื่อเปิดหน้าต่าง
    if not click_text_ocr('SAM_FG', name="ไฟล์ SAM_FG", double_click=True): return
    pyautogui.press('enter') 
    print("⏳ รอหน้าต่างขวามือโหลด 3 วินาที...")
    time.sleep(3) 
    
    # 5. สเต็ปเลือก Plant 2/1 
    # ใช้ offset_x=100 เพื่อคลิก "ถัดไปทางขวา" ของคำว่า Plant แทนที่จะคลิกตัวหนังสือ
    print("กำลังเลือกช่อง Plant...")
    # *เนื่องจาก OCR อาจจะไม่เห็นคลิกลูกศรตรงๆ เราจะหาคำว่า Plant แล้วคลิกขยับขวาไป 100 pixel เพื่อลงช่องกรอก
    # หรือใช้วิธีหาเลข "2/1" ที่คาโชว์อยู่ (ถ้ามี)
    if not click_text_ocr('Plant', name="ช่อง Plant", offset_x=100): return
    pyautogui.write('2/1') 
    pyautogui.press('enter')
    
    # 6. เลือก From Date (ย้อนหลัง 4 วัน)
    from_date_str = (datetime.now() - timedelta(days=4)).strftime("%d/%m/%Y") 
    print(f"พิมพ์ From Date: {from_date_str}")
    if click_text_ocr('From Data', name="ป้าย From Date", offset_x=130): 
        time.sleep(0.5)
        pyautogui.write(from_date_str)
        pyautogui.press('enter')
    
    # 7. เลือก To Date (ปัจจุบัน)
    to_date_str = datetime.now().strftime("%d/%m/%Y")
    print(f"พิมพ์ To Date: {to_date_str}")
    if click_text_ocr('To data', name="ป้าย To Date", offset_x=130): 
        time.sleep(0.5)
        pyautogui.write(to_date_str)
        pyautogui.press('enter')
    
    # 8. กดปุ่ม Run
    if not click_text_ocr('Run', name="ปุ่ม Run"): return
    
    print("⏳ รอประมวลผลผลลัพธ์ 10 วินาที...")
    time.sleep(10) # จำลองเวลารอ อาจต้องปรับตามจริง
    
    # 9. กดปุ่ม Copy
    if not click_text_ocr('Copy', name="ปุ่ม Copy"): return
    
    # 10. ดึงข้อมูลจาก Clipboard จบงาน
    copied_data = pyperclip.paste()
    print("🎉 ดึงข้อมูลตารางเสร็จเรียบร้อย ความยาวข้อมูล:", len(copied_data))
    
    # สเต็ปต่อไป: เอาข้อมูลไปยัดใส่ Excel

if __name__ == "__main__":
    automate_bis()
