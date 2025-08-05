
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

if __name__ == "__main__":
    create_test_pdf()
