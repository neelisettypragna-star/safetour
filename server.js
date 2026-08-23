/**
 * SafeTour AI — Backend API
 * Offline-first Tourist Safety, Risk Prediction & Disaster Rescue Coordination Website
 *
 * Simple Express + JSON-file persisted backend. No external database required —
 * good enough for a working prototype/demo, easy to swap for
 * PostgreSQL/PostGIS or MongoDB later without changing the route shapes.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());
// --- FAMILY SECURE NOTIFICATION SYSTEM ---
let familyNumbers = [];
let latestAlert = null;

app.post('/api/add-family', (req,res)=>{
    const { numbers } = req.body;
    familyNumbers = numbers;
    console.log("Family Secured:", familyNumbers.length);
    res.json({success:true, message:"Family numbers locked 🔒"});
});

app.post('/api/send-family-alert', (req,res)=>{
    const { lat, lng, userName } = req.body;
    const loc = `https://www.google.com/maps?q=${lat},${lng}`;
    latestAlert = { user: userName || "Traveller", location: loc, lat, lng, time: new Date().toLocaleString('en-IN') };
    const waLinks = familyNumbers.map(num => `https://wa.me/91${num}?text=${encodeURIComponent(`🚨 EMERGENCY! ${latestAlert.user} needs help! Location: ${loc}`)}`);
    res.json({success:true, waLinks, alert: latestAlert});
});

app.get('/api/get-alert', (req,res)=>{
    res.json(latestAlert || {});
});
// --- END ---

// Serve the index.html website file directly
app.use(express.static(__dirname));

// Database setup
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const defaultDB = {
  users: { tourists: [], authorities: [] },
  tourists: [],
  locations: [],
  incidents: [],
  rescueTeams: [],
  logs: []
};

function readDB() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2), 'utf-8');
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultDB;
  }
}

function writeDB(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Database write error:', err);
  }
}

function addLog(db, message) {
  const now = new Date();
  const timestamp = now.toTimeString().split(' ')[0];
  db.logs.unshift({ timestamp: `[${timestamp}]`, message });
  db.logs = db.logs.slice(0, 200);
}

function riskLabel(score) {
  if (score > 80) return 'CRITICAL';
  if (score > 60) return 'HIGH';
  if (score > 30) return 'MEDIUM';
  return 'LOW';
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'safetour-ai-backend', time: new Date().toISOString() });
});

app.post('/api/auth/tourist-login', (req, res) => {
  const { username, phone } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Username is required.' });

  const db = readDB();
  let tourist = db.users.tourists.find(t => t.username === username);

  if (!tourist) {
    tourist = {
      username,
      phone: phone || '',
      touristId: `ST-${1000 + Math.floor(Math.random() * 9000)}`,
      name: username
    };
    db.users.tourists.push(tourist);
  }

  addLog(db, `Tourist ${username} logged in.`);
  writeDB(db);

  res.json({
    token: `demo-token-${tourist.touristId}`,
    role: 'tourist',
    touristId: tourist.touristId,
    name: tourist.name
  });
});

app.post('/api/auth/authority-login', (req, res) => {
  const { username, password } = req.body || {};
  const db = readDB();
  const authority = db.users.authorities.find(a => a.username === username && a.password === password);

  if (!authority) {
    return res.status(401).json({ error: 'Invalid Commander username or security password.' });
  }

  addLog(db, `SDRF Commander authenticated under user node: ${username}.`);
  writeDB(db);

  res.json({
    token: `demo-token-${username}`,
    role: 'authority',
    name: authority.name
  });
});

app.get('/api/tourists', (req, res) => {
  const db = readDB();
  res.json(db.tourists);
});

app.get('/api/tourists/:id', (req, res) => {
  const db = readDB();
  const tourist = db.tourists.find(t => t.id === req.params.id);
  if (!tourist) return res.status(404).json({ error: 'Tourist not found.' });
  res.json(tourist);
});

app.post('/api/tourists/:id/telemetry', (req, res) => {
  const db = readDB();
  const { risk, gps, battery, status } = req.body || {};
  let tourist = db.tourists.find(t => t.id === req.params.id);

  if (!tourist) {
    tourist = { id: req.params.id, name: req.params.id, route: 'Unassigned', risk: 0, gps: '', signal: 'Online', battery: '100%', status: 'ON TRAIL' };
    db.tourists.push(tourist);
  }

  if (typeof risk === 'number') tourist.risk = risk;
  if (gps) tourist.gps = gps;
  if (battery) tourist.battery = battery;
  if (status) tourist.status = status;
  else if (typeof risk === 'number') tourist.status = riskLabel(risk) === 'LOW' ? 'ON TRAIL' : riskLabel(risk) + ' RISK';

  writeDB(db);
  res.json(tourist);
});

app.get('/api/locations', (req, res) => {
  const db = readDB();
  res.json(db.locations);
});

app.post('/api/risk/calculate', (req, res) => {
  const { weather = 'clear', deviation = 0, terrain = 'safe', time = 'morning', crowd = 'medium' } = req.body || {};

  let score = 5;

  if (weather === 'clear') score += 5;
  else if (weather === 'rain') score += 12;
  else if (weather === 'heavy_rain') score += 20;
  else if (weather === 'storm') score += 25;

  if (deviation <= 50) score += 2;
  else if (deviation <= 150) score += 8;
  else if (deviation <= 350) score += 17;
  else score += 25;

  if (terrain === 'safe') score += 3;
  else if (terrain === 'moderate') score += 10;
  else if (terrain === 'high_risk') score += 20;

  if (time === 'morning') score += 2;
  else if (time === 'afternoon') score += 4;
  else if (time === 'evening') score += 10;
  else if (time === 'night') score += 15;

  if (crowd === 'high') score += 2;
  else if (crowd === 'medium') score += 4;
  else if (crowd === 'low') score += 10;

  score = Math.min(score, 100);

  res.json({
    score,
    level: riskLabel(score),
    breakdown: { weather, deviation, terrain, time, crowd }
  });
});

app.get('/api/incidents', (req, res) => {
  const db = readDB();
  res.json(db.incidents);
});

app.post('/api/sos', (req, res) => {
  const db = readDB();
  const { touristId, location, type, risk, lat, lon, battery, message } = req.body || {};

  const incident = {
    id: `SOS-${100 + db.incidents.length + 1}`,
    tourist: touristId || 'UNKNOWN',
    location: location || `${lat || '—'}, ${lon || '—'}`,
    type: (type || 'INJURY').toUpperCase(),
    risk: risk || 'CRITICAL',
    time: new Date().toTimeString().slice(0, 5),
    team: null,
    status: 'ACTIVE',
    battery: battery || null,
    message: message || ''
  };

  db.incidents.unshift(incident);
  addLog(db, `SOS Broadcast Initiated by ${incident.tourist}. Type: ${incident.type}`);
  writeDB(db);

  res.status(201).json(incident);
});

app.post('/api/incidents/:id/dispatch', (req, res) => {
  const db = readDB();
  const { team } = req.body || {};
  const incident = db.incidents.find(i => i.id === req.params.id);

  if (!incident) return res.status(404).json({ error: 'Incident not found.' });
  if (!team) return res.status(400).json({ error: 'A rescue team name is required.' });

  incident.team = team;
  incident.status = 'DISPATCHED';
  addLog(db, `Rescue unit ${team} dispatched to ${incident.id} coordinates.`);
  writeDB(db);

  res.json(incident);
});

app.patch('/api/incidents/:id/resolve', (req, res) => {
  const db = readDB();
  const incident = db.incidents.find(i => i.id === req.params.id);

  if (!incident) return res.status(404).json({ error: 'Incident not found.' });

  incident.status = 'RESOLVED';
  addLog(db, `SOS Distress Signal ${incident.id} cleared.`);
  writeDB(db);

  res.json(incident);
});

app.get('/api/rescue-teams', (req, res) => {
  const db = readDB();
  res.json(db.rescueTeams);
});

app.get('/api/dashboard/stats', (req, res) => {
  const db = readDB();

  const safe = db.tourists.filter(t => t.risk <= 30).length;
  const medium = db.tourists.filter(t => t.risk > 30 && t.risk <= 60).length;
  const high = db.tourists.filter(t => t.risk > 60 && t.risk <= 80).length;
  const critical = db.tourists.filter(t => t.risk > 80).length;
  const activeSos = db.incidents.filter(i => i.status === 'ACTIVE' || i.status === 'DISPATCHED').length;

  res.json({
    touristsCount: db.tourists.length,
    touristsSafeCount: safe,
    touristsMediumRiskCount: medium,
    touristsHighRiskCount: high,
    touristsCriticalCount: critical,
    activeSosCount: activeSos
  });
});

app.get('/api/logs', (req, res) => {
  const db = readDB();
  res.json(db.logs);
});

app.post('/api/logs', (req, res) => {
  const db = readDB();
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required.' });
  addLog(db, message);
  writeDB(db);
  res.status(201).json(db.logs[0]);
});

// Serve index.html on root page load
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SafeTour AI running on port ${PORT}`);
});
