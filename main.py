import os
import json
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from twilio.rest import Client

app = FastAPI(title="RxVision API")

# Allow CORS for local dev & production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = "whatsapp:+14155238886"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


def extract_prescription_data(image_bytes: bytes):
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = """
    You are an expert medical OCR assistant. Analyze this prescription or discharge note.
    Extract the medications into structured JSON.
    Provide:
    1. "medications": list of objects containing ("name", "dosage", "frequency", "duration", "plain_english_instructions")
    2. "warnings": list of key warnings or red flags for the patient
    3. "schedule": suggested daily schedule times (e.g., ["08:00 AM", "08:00 PM"])

    Return ONLY valid JSON matching this schema.
    """
    
    response = model.generate_content([
        prompt, 
        {"mime_type": "image/jpeg", "data": image_bytes}
    ])
    
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_json)


def check_drug_interactions(med_names: list[str]):
    rxcuis = []
    for name in med_names:
        url = f"https://rxnav.nlm.nih.gov/REST/rxcui.json?name={name}"
        res = requests.get(url).json()
        try:
            rxcui = res['idGroup']['rxnormId'][0]
            rxcuis.append(rxcui)
        except (KeyError, IndexError):
            continue

    if len(rxcuis) < 2:
        return {"has_interaction": False, "details": ["At least 2 valid medications are required to check interactions."]}

    rxcui_list_str = "+".join(rxcuis)
    interaction_url = f"https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis={rxcui_list_str}"
    int_res = requests.get(interaction_url).json()

    warnings = []
    try:
        full_group = int_res['fullInteractionTypeGroup']
        for group in full_group:
            for item in group['fullInteractionType']:
                for pair in item['interactionPair']:
                    warnings.append(pair['description'])
    except KeyError:
        pass

    return {
        "has_interaction": len(warnings) > 0,
        "details": warnings if warnings else ["No known critical interactions found."]
    }


@app.get("/")
def read_root():
    return {"status": "RxVision API operational"}


@app.post("/api/analyze-prescription")
async def analyze_prescription(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        extracted_data = extract_prescription_data(contents)
        med_names = [med['name'] for med in extracted_data.get('medications', [])]
        interactions = check_drug_interactions(med_names)
        
        return {
            "success": True,
            "data": extracted_data,
            "interactions": interactions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/send-whatsapp-reminder")
async def send_whatsapp_reminder(phone_number: str = Form(...), message: str = Form(...)):
    try:
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        formatted_to = f"whatsapp:{phone_number}" if not phone_number.startswith("whatsapp:") else phone_number
        
        msg = client.messages.create(
            body=f"💊 *RxVision Reminder* 💊\n\n{message}",
            from_=TWILIO_WHATSAPP_NUMBER,
            to=formatted_to
        )
        return {"success": True, "sid": msg.sid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
