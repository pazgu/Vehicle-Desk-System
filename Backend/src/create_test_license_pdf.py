# from fpdf import FPDF
# import os

# # ודא שתיקיית הבדיקות קיימת
# os.makedirs("test_files", exist_ok=True)

# # צור קובץ PDF לדוגמה
# pdf = FPDF()
# pdf.add_page()
# pdf.set_font("Arial", size=14)
# pdf.cell(200, 10, txt="Government License", ln=True, align='C')
# pdf.cell(200, 10, txt="This is a test license PDF for upload.", ln=True, align='C')

# # שמור את הקובץ
# file_path = "test_files/test_license.pdf"
# pdf.output(file_path)

# print(f"✅ Created test file: {file_path}")


# from fpdf import FPDF
# import os

# def create_test_pdf(filename="test_license_2.pdf"):
#     pdf = FPDF()
#     pdf.add_page()
#     pdf.set_font("Arial", size=12)
#     pdf.cell(200, 10, txt="This is a second test PDF for license upload.", ln=True, align='C')
#     pdf.output(filename)
#     print(f"✅ Created test file: {os.path.abspath(filename)}")

# if __name__ == "__main__":
#     create_test_pdf()


from fpdf import FPDF
import os

def create_test_pdf(filename="test_license3.pdf"):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=16)
    pdf.cell(200, 10, txt="This is a test license PDF", ln=True, align="C")
    
    # שמירה בתיקייה 'test_files'
    os.makedirs("test_files", exist_ok=True)
    filepath = os.path.join("test_files", filename)
    pdf.output(filepath)
    print(f"✅ Created test file: {filepath}")

if __name__ == "__main__":
    create_test_pdf()
