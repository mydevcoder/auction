const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// Default route → serve app.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "app.html"));
});


// MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/cricketAuction")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error(err));

// Schemas
const teamSchema = new mongoose.Schema({
  name: String,
  credits: { type: Number, default: 10000 },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
});

const playerSchema = new mongoose.Schema({
  name: String,
  className: String,
  basePrice: Number,
  sold: { type: Boolean, default: false },
  team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
  soldPrice: { type: Number, default: 0 },
});

const auctionSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
  currentBid: Number,
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },
});

const Team = mongoose.model("Team", teamSchema);
const Player = mongoose.model("Player", playerSchema);
const Auction = mongoose.model("Auction", auctionSchema);

// Routes

// Create player and start auction immediately
app.post("/auction/new", async (req, res) => {
  try {
    const { name, className, basePrice } = req.body;

    // Create player
    const player = new Player({ name, className, basePrice });
    await player.save();

    // Start auction for this player
    const auction = new Auction({ player: player._id, currentBid: basePrice });
    await auction.save();

    res.json({ player, auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// // Create new player
// app.post("/player", async (req, res) => {
//   try {
//     const { name, className, basePrice } = req.body;
//     const player = new Player({ name, className, basePrice });
//     await player.save();
//     res.json(player);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// Get all players with team populated
app.get("/players", async (req, res) => {
  const players = await Player.find().populate("team"); // ✅ populate team name
  res.json(players);
});

// Create new team
app.post("/team", async (req, res) => {
  const { name } = req.body;
  const team = new Team({ name });
  await team.save();
  res.json(team);
});

// Get team details
app.get("/team/:id", async (req, res) => {
  const team = await Team.findById(req.params.id).populate("players");
  res.json(team);
});

// Start auction for player
app.post("/auction/start/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const { basePrice } = req.body;

  const auction = new Auction({ player: playerId, currentBid: basePrice });
  await auction.save();

  res.json(auction);
});

// Place bid
app.post("/auction/bid/:auctionId", async (req, res) => {
  const { auctionId } = req.params;
  const { teamId, bidAmount } = req.body;

  const auction = await Auction.findById(auctionId).populate("player");
  const team = await Team.findById(teamId);

  if (!auction || !team) return res.status(404).json({ error: "Not found" });

  if (bidAmount > team.credits) {
    return res.status(400).json({ error: "Not enough credits" });
  }

  if (team.players.length >= 26) {
    return res.status(400).json({ error: "Team already has 26 players" });
  }

  if (bidAmount <= auction.currentBid) {
    return res
      .status(400)
      .json({ error: "Bid must be higher than current bid" });
  }

  auction.currentBid = bidAmount;
  auction.highestBidder = teamId;
  await auction.save();

  res.json(auction);
});

// Finalize auction (Won Player)
app.post("/auction/finalize/:auctionId", async (req, res) => {
  const { auctionId } = req.params;
  const auction = await Auction.findById(auctionId).populate("player");

  if (!auction) return res.status(404).json({ error: "Auction not found" });

  const team = await Team.findById(auction.highestBidder);
  const player = await Player.findById(auction.player);

  if (!team || !player) return res.status(404).json({ error: "Not found" });

  team.credits -= auction.currentBid;
  team.players.push(player._id);

  player.sold = true;
  player.team = team._id;
  player.soldPrice = auction.currentBid;

  await team.save();
  await player.save();
  await auction.deleteOne();

  res.json({ message: "Auction finalized", team, player });
});
// ✅ Create initial teams if not exist
const initialTeams = [
  "IMJ NINJAS",
  "IMJ IGNITORS",
  "IMJ TITANS",
  "IMJ FALCONS",
  "IMJ PHANTOMS",
  "IMJ HAWKS",
];

async function ensureTeams() {
  for (const name of initialTeams) {
    const exists = await Team.findOne({ name });
    if (!exists) {
      await new Team({ name }).save();
      console.log(`Team created: ${name}`);
    }
  }
}
ensureTeams();

// ✅ Get team by name
app.get("/team/byName/:name", async (req, res) => {
  const team = await Team.findOne({ name: req.params.name });
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

// Drop Player (remove from auction without selling)
app.post("/auction/drop/:auctionId", async (req, res) => {
  const { auctionId } = req.params;
  await Auction.findByIdAndDelete(auctionId);
  res.json({ message: "Player dropped from auction" });
});

// Server
const PORT = 5000;

app.listen(PORT, () => console.log(`http://localhost:5000`));
