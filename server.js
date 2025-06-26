const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const path = require("path");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));


let players = [];
let matches = [];
let ratings = {};

function calculateElo(p1, p2, winner) {
  const K = 32;
  const R1 = ratings[p1] || 1000;
  const R2 = ratings[p2] || 1000;
  const E1 = 1 / (1 + Math.pow(10, (R2 - R1) / 400));
  const E2 = 1 / (1 + Math.pow(10, (R1 - R2) / 400));

  if (winner === p1) {
    ratings[p1] = R1 + K * (1 - E1);
    ratings[p2] = R2 + K * (0 - E2);
  } else {
    ratings[p1] = R1 + K * (0 - E1);
    ratings[p2] = R2 + K * (1 - E2);
  }
}

function updateRatings(match) {
  match.winners.forEach((w, i) => {
    const l = match.losers[i];
    calculateElo(w, l, w);
  });
}

function filterRatingsByCategory(category) {
  const currentYear = new Date().getFullYear();
  return players
    .filter(p => {
      if (category === "flinta") return p.gender.toLowerCase() === "flinta";
      if (category === "u23") return currentYear - p.year < 23;
      if (category === "ue30") return currentYear - p.year >= 30;
      return true;
    })
    .map(p => ({
      username: p.username,
      rating: ratings[p.username] || 1000
    }));
}

app.get("/players", (req, res) => res.json(players));
app.get("/ratings", (req, res) => res.json(ratings));
app.get("/ratings/:category", (req, res) => {
  const category = req.params.category.toLowerCase();
  res.json(filterRatingsByCategory(category));
});
app.get("/matches", (req, res) => res.json(matches));

app.post("/player", upload.single("photo"), (req, res) => {
  const { username, year, gender } = req.body;
  const photo = req.file ? req.file.path : null;
  const player = { username, year: parseInt(year), gender, photo };
  players.push(player);
  ratings[username] = 1000;
  res.redirect("/");
});

app.post("/match", (req, res) => {
  const { winners, losers } = req.body;
  const match = { winners, losers, date: new Date() };
  matches.push(match);
  updateRatings(match);
  res.json({ success: true });
});

app.get("/", (req, res) => {
  res.send(`
  <html>
    <head><title>Beachvolleyball ELO</title></head>
    <body>
      <h1>🏐 Spieler*in erstellen</h1>
      <form action="/player" method="POST" enctype="multipart/form-data">
        <input name="username" placeholder="Nutzername" required><br>
        <input name="year" type="number" placeholder="Jahrgang" required><br>
        <select name="gender">
          <option value="male">Male</option>
          <option value="flinta">FLINTA</option>
        </select><br>
        <input type="file" name="photo"><br>
        <button type="submit">Hinzufügen</button>
      </form>

      <h1>📊 Match eintragen</h1>
      <form action="/match" method="POST" onsubmit="submitMatch(event)">
        <p>Gewinner-Team (2 Spieler):</p>
        <input name="winners" placeholder="z.B. Anna, Ben" required><br>
        <p>Verlierer-Team (2 Spieler):</p>
        <input name="losers" placeholder="z.B. Chris, Dana" required><br>
        <button type="submit">Match eintragen</button>
      </form>

      <h1>📈 Ratings anzeigen</h1>
      <ul>
        <li><a href="/ratings">Alle</a></li>
        <li><a href="/ratings/flinta">FLINTA</a></li>
        <li><a href="/ratings/u23">U23</a></li>
        <li><a href="/ratings/ue30">Ü30</a></li>
      </ul>

      <script>
        function submitMatch(e) {
          e.preventDefault();
          const winners = document.querySelector('[name="winners"]').value.split(',').map(x => x.trim());
          const losers = document.querySelector('[name="losers"]').value.split(',').map(x => x.trim());
          fetch('/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ winners, losers })
          })
          .then(res => res.json())
          .then(data => {
            alert('Match gespeichert!');
            window.location.reload();
          });
        }
      </script>
    </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
