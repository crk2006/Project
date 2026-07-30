import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React, { useState } from 'react';
import { Upload, AlertTriangle, Bell, Pill, CheckCircle, ShieldAlert } from 'lucide-react';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [reminderSent, setReminderSent] = useState(false);

  // Backend local server endpoint
  const API_BASE_URL = "http://localhost:8000";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze-prescription`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        setResult(data);
      } else {
        alert("Failed to analyze image.");
      }
    } catch (err) {
      alert("Error connecting to server. Make sure Python FastAPI is running!");
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleReminder = async () => {
    if (!phoneNumber) return alert("Enter a valid phone number with country code!");
    
    const formData = new FormData();
    formData.append('phone_number', phoneNumber);
    
    const summary = result.data.medications
      .map(m => `• ${m.name} (${m.dosage}): ${m.plain_english_instructions}`)
      .join('\n');
      
    formData.append('message', `Your active medication schedule:\n\n${summary}`);

    try {
      const res = await fetch(`${API_BASE_URL}/api/send-whatsapp-reminder`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setReminderSent(true);
      }
    } catch (err) {
      alert("Failed to send WhatsApp alert.");
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>RxVision 🩺</h1>
        <p style={styles.subtitle}>AI Prescription Reader & Recovery Companion</p>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h3>Upload Prescription / Discharge Summary</h3>
          <div style={styles.uploadZone}>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              id="file-input" 
              style={{ display: 'none' }} 
            />
            <label htmlFor="file-input" style={styles.uploadBtn}>
              <Upload size={20} style={{ marginRight: 8 }} />
              Select Photo
            </label>
            {previewUrl && <img src={previewUrl} alt="Prescription" style={styles.preview} />}
          </div>

          <button 
            onClick={handleUpload} 
            disabled={!selectedFile || loading} 
            style={{...styles.actionBtn, opacity: (!selectedFile || loading) ? 0.6 : 1}}
          >
            {loading ? "Analyzing Prescription..." : "Process Prescription"}
          </button>
        </div>

        {result && (
          <div style={styles.resultsContainer}>
            {result.interactions.has_interaction && (
              <div style={{ ...styles.alertBox, backgroundColor: '#ffebee', borderColor: '#f44336' }}>
                <ShieldAlert color="#d32f2f" size={24} />
                <div style={{ marginLeft: 12 }}>
                  <strong style={{ color: '#d32f2f' }}>Drug Interaction Warning!</strong>
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                    {result.interactions.details.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div style={styles.card}>
              <h3><Pill size={20} color="#2196f3"/> Extracted Medications</h3>
              {result.data.medications.map((med, idx) => (
                <div key={idx} style={styles.medCard}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {med.name} <span style={styles.badge}>{med.dosage}</span>
                  </div>
                  <p style={{ margin: '5px 0' }}><b>Instructions:</b> {med.plain_english_instructions}</p>
                  <p style={{ margin: '5px 0' }}><b>Frequency:</b> {med.frequency} ({med.duration})</p>
                </div>
              ))}
            </div>

            {result.data.warnings && result.data.warnings.length > 0 && (
              <div style={styles.card}>
                <h3><AlertTriangle size={20} color="#ff9800"/> Care Warnings</h3>
                <ul>
                  {result.data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div style={styles.card}>
              <h3><Bell size={20} color="#4caf50"/> WhatsApp Dosage Alerts</h3>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>Receive automated alerts straight to your phone.</p>
              
              <div style={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="+1234567890" 
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={styles.input}
                />
                <button onClick={handleScheduleReminder} style={styles.reminderBtn}>
                  Send Alert
                </button>
              </div>

              {reminderSent && (
                <p style={{ color: 'green', marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={16} /> Reminder dispatched successfully!
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f6f9', minHeight: '100vh', padding: '20px' },
  header: { textAlign: 'center', marginBottom: '20px' },
  title: { color: '#1a237e', margin: 0 },
  subtitle: { color: '#5c6bc0', marginTop: '5px' },
  main: { maxWidth: '600px', margin: '0 auto' },
  card: { backgroundColor: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  uploadZone: { display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '15px 0' },
  uploadBtn: { backgroundColor: '#e8eaf6', color: '#3f51b5', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  preview: { width: '100%', maxHeight: '250px', objectFit: 'contain', marginTop: '15px', borderRadius: '8px' },
  actionBtn: { width: '100%', backgroundColor: '#3f51b5', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
  resultsContainer: { marginTop: '10px' },
  medCard: { backgroundColor: '#f9f9f9', borderLeft: '4px solid #3f51b5', padding: '12px', margin: '10px 0', borderRadius: '0 8px 8px 0' },
  badge: { backgroundColor: '#e3f2fd', color: '#1976d2', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', marginLeft: '8px' },
  alertBox: { padding: '15px', borderRadius: '8px', border: '1px solid', display: 'flex', alignItems: 'flex-start', marginBottom: '20px' },
  inputGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  input: { flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' },
  reminderBtn: { backgroundColor: '#4caf50', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer' }
};
