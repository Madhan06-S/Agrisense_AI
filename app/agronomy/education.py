import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Educational content repository
EDUCATION_LIBRARY = {
    "flood_preparedness": {
        "topic": "Flood Preparedness for Pastures",
        "formats": {
            "sms": "AgriSense: Heavy rains predicted. Move livestock to elevated areas and harvest mature fodder early.",
            "voice_hindi": "नमस्ते किसान भाई, भारी बारिश की चेतावनी है। कृपया अपने मवेशियों को ऊंचे स्थानों पर ले जाएं और चारे की कटाई पहले कर लें।",
            "voice_tamil": "வணக்கம் விவசாயி, கனமழை எச்சரிக்கை உள்ளது. கால்நடைகளை மேடான பகுதிக்கு கொண்டு செல்லுங்கள்.",
            "tutorial_3d": "3D Interactive Simulation: Visualizes rising flood lines over digital terrain models and marks optimal dry zone shelters.",
            "pdf_guide_url": "http://localhost:8000/api/v1/agronomy/education/flood_preparedness/pdf"
        }
    },
    "pasture_rotation": {
        "topic": "Sustainable Pasture Rotation Practices",
        "formats": {
            "sms": "AgriSense: Avoid overgrazing. Rotate grazing blocks every 14 days to allow root zone replenishment.",
            "voice_hindi": "नमस्ते, चरागाह को नष्ट होने से बचाने के लिए प्रत्येक १४ दिनों में मवेशियों के चरने की दिशा बदलें।",
            "voice_tamil": "அதிவேக மேய்ச்சலைத் தவிர்க்க, 14 நாட்களுக்கு ஒருமுறை கால்நடைகளின் மேய்ச்சல் இடத்தை மாற்றுங்கள்.",
            "tutorial_3d": "3D Tutorial: Interactive drag-and-drop fence placements showing root system regrowth rates under rotational grazing.",
            "pdf_guide_url": "http://localhost:8000/api/v1/agronomy/education/pasture_rotation/pdf"
        }
    }
}

def get_educational_materials(topic: str) -> Dict[str, Any]:
    """Retrieves specific topics parsed into multiple delivery formats."""
    content = EDUCATION_LIBRARY.get(topic)
    if not content:
        raise ValueError(f"Educational content for topic '{topic}' not found.")
    return content
