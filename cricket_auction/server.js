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
  usedCredits: { type: Number, default: 0 }, // ✅ Track used credits separately
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

    const player = new Player({ name, className, basePrice });
    await player.save();

    const auction = new Auction({ player: player._id, currentBid: basePrice });
    await auction.save();

    res.json({ player, auction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all players with team populated
app.get("/players", async (req, res) => {
  const players = await Player.find().populate("team");
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

// GET team by exact name (case-insensitive)
app.get("/team/byName/:name", async (req, res) => {
  try {
    const team = await Team.findOne({
      name: { $regex: `^${req.params.name}$`, $options: "i" },
    }).populate("players");
    if (!team) return res.status(404).json({ error: "Team not found" });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch team" });
  }
});

// Fetch teams with players populated
app.get("/teams", async (req, res) => {
  try {
    const teams = await Team.find().populate("players");
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch teams" });
  }
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

  if (bidAmount > team.credits)
    return res.status(400).json({ error: "Not enough credits" });
  if (team.players.length >= 26)
    return res.status(400).json({ error: "Team already has 26 players" });
  if (bidAmount <= auction.currentBid)
    return res
      .status(400)
      .json({ error: "Bid must be higher than current bid" });

  auction.currentBid = bidAmount;
  auction.highestBidder = teamId;
  await auction.save();

  res.json(auction);
});

// Finalize auction
app.post("/auction/finalize/:auctionId", async (req, res) => {
  const { auctionId } = req.params;
  const auction = await Auction.findById(auctionId).populate("player");

  if (!auction) return res.status(404).json({ error: "Auction not found" });

  const team = await Team.findById(auction.highestBidder);
  const player = await Player.findById(auction.player);

  if (!team || !player) return res.status(404).json({ error: "Not found" });

  // ✅ Deduct credits & track used credits
  team.credits -= auction.currentBid;
  team.usedCredits += auction.currentBid;
  team.players.push(player._id);

  // ✅ Mark player as sold
  player.sold = true;
  player.team = team._id;
  player.soldPrice = auction.currentBid;

  await team.save();
  await player.save();
  await auction.deleteOne();

  res.json({ message: "Auction finalized", team, player });
});

// Initial Teams
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

// Save & Reset Route - resets sold players and team rosters
app.post("/auction/save-reset", async (_req, res) => {
  try {
    const soldPlayers = await Player.find({ sold: true });

    for (const player of soldPlayers) {
      player.sold = false;
      player.soldPrice = 0;
      player.team = null;
      await player.save();
    }

    await Auction.deleteMany({});

    const teams = await Team.find();
    for (const team of teams) {
      team.credits = 10000;
      team.usedCredits = 0; // ✅ Reset used credits
      team.players = [];
      await team.save();
    }

    res.json({
      message: "All sold players reset. Unsold players remain unchanged.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset auctions" });
  }
});

// Checkpoint – keeps sold players & standings, closes only open auctions
app.post("/auction/checkpoint", async (_req, res) => {
  try {
    await Auction.deleteMany({});
    return res.json({ message: "Auctions closed – standings saved." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Checkpoint failed" });
  }
});

// Drop auction manually
app.post("/auction/drop/:id", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ error: "Auction not found" });

    const player = await Player.findById(auction.player);
    if (player) {
      player.sold = false;
      player.soldPrice = 0;
      player.team = null;
      await player.save();
    }

    await Auction.findByIdAndDelete(req.params.id);

    res.json({ message: "Player dropped and marked as unsold." });
  } catch (err) {
    res.status(500).json({ error: "Failed to drop player" });
  }
});

// Delete a player permanently (unsold)
app.delete("/player/:id", async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ error: "Player not found" });

    if (player.sold) {
      return res.status(400).json({ error: "Cannot delete a sold player" });
    }

    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: "Unsold player deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete player" });
  }
});

// Server
const PORT = 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
