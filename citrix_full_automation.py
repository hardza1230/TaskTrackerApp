import asyncio
import os
import glob
from playwright.async_api import async_playwright

# ตั้งค่าต่างๆ
CITRIX_URL = "http://172.16.10.80/Citrix/XenApp/auth/login.aspx"
USERNAME = "norrasates"
PASSWORD = "123456abcd#####"  # รหัสผ่านที่เคยใช้ใน PAD
DOWNLOAD_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
APP_NAME_TO_CLICK = "Syteline_SKU"

async def clear_old_ica_files():
    print(f"[*] 1. กำลังล้างไฟล์ .ica เก่าใน {DOWNLOAD_DIR}...")
    search_pattern = os.path.join(DOWNLOAD_DIR, "*.ica")
    for f in glob.glob(search_pattern):
        try:
            os.remove(f)
        except Exception:
            pass

async def download_ica_via_playwright():
    print("[*] 2. เริ่มต้นเปิดเบราว์เซอร์ Edge เพื่อเข้า Citrix Web...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="msedge", headless=False) 
        context = await browser.new_context(accept_downloads=True)
        page = await context.new_page()

        try:
            await page.goto(CITRIX_URL, wait_until="networkidle")
            
            print("[*] 3. กำลังกรอกข้อมูลล็อกอิน...")
            await page.fill('input[type="text"]', USERNAME) 
            await page.fill("input[type='password']", PASSWORD)
            await page.click("text='Log On'")
            
            # --- เริ่มขั้นตอนการตั้งค่า Dimension หน้าจอ Citrix ---
            try:
                print("[*] 4. เข้าสู่เมนู Preferences เพื่อตั้งค่าหน้าจอ...")
                await page.click("text='Preferences'")
                
                print("[*] 5. เลือกเมนู Session Settings...")
                await page.click("#sessionSettings")

                print("[*] 6. เลือก Window size เป็น Custom และกรอกขนาด 1600x800...")
                try:
                    await page.select_option("#slWindowSize", value="custom")
                    await page.fill("#txtDesiredHRES", "1600") 
                    await page.fill("#txtDesiredVRES", "800")
                    
                    print("[*] 7. กดปุ่ม Save...")
                    await page.click("#submit1")
                except Exception as setting_e:
                    print(f"[-] ไม่สามารถตั้งค่า Dimension ได้: {setting_e}")
                    try:
                        html_content = await page.content()
                        with open("citrix_session_settings_error.html", "w", encoding="utf-8") as f:
                            f.write(html_content)
                    except:
                        pass
                
                print("[*] 8. กลับมาที่หน้าจอหลัก (Main/Applications)...")
                await page.click("#navAppListLink")
            except Exception as pref_e:
                print(f"[!] เกิดข้อผิดพลาดตอนตั้งค่า Preferences (อาจหาปุ่มไม่เจอ): {pref_e}")
                
                # --- เพิ่มโค้ดเซฟหน้าเว็บเผื่อ AI เอาไปวิเคราะห์ ---
                try:
                    html_content = await page.content()
                    with open("citrix_prefs_error.html", "w", encoding="utf-8") as f:
                        f.write(html_content)
                except:
                    pass
                
                print("[*] แจ้งเตือน: กำลังโหลดข้ามไปดาวน์โหลดแอปเลยเพื่อความต่อเนื่อง...")
            # --- จบขั้นตอนตั้งค่า ---

            print(f"[*] 9. หน่วงเวลาเล็กน้อยเพื่อให้ระบบเซฟการตั้งค่าให้เรียบร้อย...")
            await asyncio.sleep(2.5) # ตามคำขอ: ให้ช้าลงตรงช่วงท้ายที่จะกดดาวน์โหลด

            print(f"[*] 10. กดดาวน์โหลดแอป {APP_NAME_TO_CLICK}...")
            async with page.expect_download() as download_info:
                await page.click(f"text='{APP_NAME_TO_CLICK}'")
            
            download = await download_info.value
            download_path = os.path.join(DOWNLOAD_DIR, "launch.ica")
            await download.save_as(download_path)
            print(f"[*] ดาวน์โหลดไฟล์ไปที่: {download_path} สำเร็จ!")
            return download_path
            
        except Exception as e:
            print(f"[!] เกิดข้อผิดพลาดฝั่งเว็บ: {e}")
            await page.screenshot(path="error_web_login.png")
            return None
        finally:
            await browser.close()

def wait_for_image_on_screen(image_path, timeout=60):
    pass # กลายเป็นระบบ Semi-Auto แล้ว ฟังก์ชันนี้ลบทิ้งได้ความจริง แต่เว้นไว้เผื่ออยากเอากลับมา
    
async def main_workflow():
    print("=== เริ่มกระบวนการดาวน์โหลด Citrix แบบ Semi-Automate ===")
    await clear_old_ica_files()
    ica_path = await download_ica_via_playwright()
    
    if ica_path and os.path.exists(ica_path):
        print("[*] 11. สั่งรัน Citrix Workspace จากไฟล์ ICA...")
        try:
            os.startfile(ica_path)
            print("[*] 🎉 เปิดไฟล์เสร็จสิ้น! เชิญคุณดำเนินการหน้า Citrix Login ต่อได้เลยครับ!")
        except Exception as e:
            print(f"[!]เกิดข้อผิดพลาดตอนรันไฟล์: {e}")
    else:
        print("[!] กระบวนการเว็บล้มเหลว ยกเลิกการรันแอป")

if __name__ == "__main__":
    asyncio.run(main_workflow())
