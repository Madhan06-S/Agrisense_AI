import os
import logging
from datetime import datetime
from typing import Dict, Any, List
from fpdf import FPDF
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from app.models.models import Farm, SatelliteImage
from app.pipeline.alerts import send_telegram_alert, send_fcm_push

logger = logging.getLogger(__name__)

class QualityPDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 15)
        self.cell(0, 10, 'AgriSense AI - Satellite Data Quality Report', border=False, ln=True, align='C')
        self.ln(5)
        self.set_line_width(0.5)
        self.line(10, 22, 200, 22)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')

def generate_monthly_pdf_report(
    farm_name: str,
    crop_type: str,
    district: str,
    state: str,
    month_name: str,
    year: int,
    acquisitions: List[Dict[str, Any]],
    output_path: str
) -> str:
    """Generates a monthly quality report PDF using fpdf2 and PIL for preview graphics."""
    pdf = QualityPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_font("helvetica", size=10)
    
    # Details Box
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, f"Farm Quality Profile: {farm_name}", ln=True)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 6, f"Crop Type: {crop_type}", ln=True)
    pdf.cell(0, 6, f"Location: {district}, {state}", ln=True)
    pdf.cell(0, 6, f"Report Month: {month_name} {year}", ln=True)
    pdf.ln(5)
    
    # Ingests table
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(0, 10, "Acquisition Ingest Metrics", ln=True)
    
    pdf.set_font("helvetica", "B", 9)
    pdf.cell(30, 8, "Date", border=1)
    pdf.cell(35, 8, "Satellite Source", border=1)
    pdf.cell(30, 8, "Cloud Cover", border=1)
    pdf.cell(35, 8, "Quality Score", border=1)
    pdf.cell(50, 8, "Status", border=1, ln=True)
    
    pdf.set_font("helvetica", "", 9)
    
    total_score = 0.0
    valid_count = 0
    
    for acq in acquisitions:
        date_str = acq.get("date", "N/A")
        sat = acq.get("satellite", "N/A")
        cc = acq.get("cloud_cover", 0.0)
        score = acq.get("quality_score", 0.0)
        status = "Needs Review" if score < 60.0 else "Passed"
        
        pdf.cell(30, 8, date_str, border=1)
        pdf.cell(35, 8, sat, border=1)
        pdf.cell(30, 8, f"{cc:.1f}%", border=1)
        pdf.cell(35, 8, f"{score:.1f}/100", border=1)
        pdf.cell(50, 8, status, border=1, ln=True)
        
        total_score += score
        valid_count += 1
        
    avg_score = total_score / valid_count if valid_count > 0 else 0.0
    pdf.ln(5)
    
    pdf.set_font("helvetica", "B", 11)
    pdf.cell(0, 10, f"Average Quality Index: {avg_score:.1f}/100", ln=True)
    
    # Generate inline graphic / thumbnail preview using PIL
    img_dir = os.path.dirname(output_path)
    os.makedirs(img_dir, exist_ok=True)
    thumb_path = os.path.join(img_dir, f"farm_preview_{month_name}_{year}.png")
    
    # Create simple preview thumbnail image
    preview = Image.new("RGB", (400, 120), color=(245, 247, 245))
    draw = ImageDraw.Draw(preview)
    # Simple outline
    draw.rectangle([5, 5, 395, 115], outline=(0, 128, 64), width=2)
    # Write text info
    draw.text((20, 20), f"AgriSense Quality Index: {avg_score:.1f}", fill=(0, 100, 50))
    draw.text((20, 50), f"Total Scenes Evaluated: {valid_count}", fill=(50, 50, 50))
    draw.text((20, 80), f"Status: {'CRITICAL DEGRADATION' if avg_score < 60 else 'HEALTHY DATASET'}", fill=(200, 0, 0) if avg_score < 60 else (0, 128, 0))
    
    preview.save(thumb_path)
    
    # Embed inside PDF
    pdf.ln(10)
    pdf.cell(0, 6, "Data Visualization Preview:", ln=True)
    pdf.image(thumb_path, x=15, w=120)
    
    pdf.output(output_path)
    return output_path

async def check_consecutive_drops(db, farm_id: int) -> bool:
    """
    Checks if quality score is below 60 for the last 3 consecutive acquisitions.
    Sends alerts if triggered.
    """
    try:
        stmt = select(SatelliteImage).where(
            SatelliteImage.farm_id == farm_id
        ).order_by(SatelliteImage.acquisition_date.desc()).limit(3)
        
        res = await db.execute(stmt)
        images = res.scalars().all()
        
        if len(images) < 3:
            return False
            
        failures = 0
        for img in images:
            extra = img.extra_metadata or {}
            metrics = extra.get("quality_metrics", {})
            score = metrics.get("composite")
            if score is None:
                # Fallback to simple calculation
                score = 100.0 - img.cloud_cover
                
            if score < 60.0:
                failures += 1
                
        if failures == 3:
            alert_msg = f"WARNING: Farm {farm_id} experienced 3 consecutive low quality acquisitions (< 60.0)!"
            logger.warning(alert_msg)
            await send_telegram_alert(alert_msg)
            await send_fcm_push("Quality Degradation Alert", alert_msg)
            return True
            
        return False
    except Exception as e:
        logger.error(f"Error checking consecutive drops for farm {farm_id}: {e}")
        return False
