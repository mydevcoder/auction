/* --------------  cricket-auction server  -------------- */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const PORT = process.env.PORT || 5000;
const app = express();

/* ---------- middleware ---------- */
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public', 'dist')));

/* ---------- single root handler ---------- */
app.get('/', (_req, res) =>
  res.sendFile(path.resolve(__dirname, 'public', 'dist', 'index.html'))
);

/* =================================================================
   SCHEMAS
================================================================= */
const teamSchema = new mongoose.Schema({
  name: String,
  credits: { type: Number, default: 10000 },
  usedCredits: { type: Number, default: 0 },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
});

const playerSchema = new mongoose.Schema({
  name: String,
  className: String,
  basePrice: Number,
  sold: { type: Boolean, default: false },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  soldPrice: { type: Number, default: 0 },
});

const auctionSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  currentBid: Number,
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
});

const Team = mongoose.model('Team', teamSchema);
const Player = mongoose.model('Player', playerSchema);
const Auction = mongoose.model('Auction', auctionSchema);

/* =================================================================
   ROUTES
================================================================= */
/*  health  */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

/*  players  */
app.get('/players', async (_req, res) => {
  res.json(await Player.find().populate('team'));
});

app.delete('/player/:id', async (req, res) => {
  const p = await Player.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'Player not found' });
  if (p.sold) return res.status(400).json({ error: 'Cannot delete sold player' });
  await Player.findByIdAndDelete(req.params.id);
  res.json({ message: 'Unsold player deleted' });
});

/*  teams  */
app.post('/team', async (req, res) => {
  const team = await Team.create({ name: req.body.name });
  res.json(team);
});

app.get('/team/:id', async (req, res) => {
  const team = await Team.findById(req.params.id).populate('players');
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(team);
});

app.get('/team/byName/:name', async (req, res) => {
  const team = await Team.findOne({
    name: { $regex: `^${req.params.name}$`, $options: 'i' },
  }).populate('players');
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(team);
});

app.get('/teams', async (_req, res) => {
  res.json(await Team.find().populate('players'));
});

/*  auction  */
app.post('/auction/new', async (req, res) => {
  const { name, className, basePrice } = req.body;
  const player = await Player.create({ name, className, basePrice });
  const auction = await Auction.create({ player: player._id, currentBid: basePrice });
  res.json({ player, auction });
});

app.post('/auction/start/:playerId', async (req, res) => {
  const auction = await Auction.create({
    player: req.params.playerId,
    currentBid: req.body.basePrice,
  });
  res.json(auction);
});

app.post('/auction/bid/:auctionId', async (req, res) => {
  const { auctionId } = req.params;
  const { teamId, bidAmount } = req.body;

  const [auction, team] = await Promise.all([
    Auction.findById(auctionId).populate('player'),
    Team.findById(teamId),
  ]);

  if (!auction || !team) return res.status(404).json({ error: 'Not found' });
  if (bidAmount > team.credits) return res.status(400).json({ error: 'Not enough credits' });
  if (team.players.length >= 26) return res.status(400).json({ error: 'Team already has 26 players' });
  if (bidAmount <= auction.currentBid) return res.status(400).json({ error: 'Bid must be higher' });

  auction.currentBid = bidAmount;
  auction.highestBidder = teamId;
  await auction.save();
  res.json(auction);
});

app.post('/auction/finalize/:auctionId', async (req, res) => {
  const auction = await Auction.findById(req.params.auctionId)
                               .populate('player')
                               .populate('highestBidder');
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const team = auction.highestBidder;
  const player = auction.player;
  if (!team || !player) return res.status(404).json({ error: 'Not found' });

  team.credits -= auction.currentBid;
  team.usedCredits += auction.currentBid;
  team.players.push(player._id);

  player.sold = true;
  player.team = team._id;
  player.soldPrice = auction.currentBid;

  await Promise.all([team.save(), player.save(), auction.deleteOne()]);
  res.json({ message: 'Auction finalized', team, player });
});

/*  utility  */
app.post('/auction/save-reset', async (_req, res) => {
  await Player.updateMany({ sold: true }, { sold: false, soldPrice: 0, team: null });
  await Auction.deleteMany({});
  await Team.updateMany({}, { credits: 10000, usedCredits: 0, players: [] });
  res.json({ message: 'All sold players reset. Unsold remain unchanged.' });
});

app.post('/auction/checkpoint', async (_req, res) => {
  await Auction.deleteMany({});
  res.json({ message: 'Auctions closed – standings saved.' });
});

app.post('/auction/drop/:id', async (req, res) => {
  const auction = await Auction.findById(req.params.id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  await Player.findByIdAndUpdate(auction.player, { sold: false, soldPrice: 0, team: null });
  await auction.deleteOne();
  res.json({ message: 'Player dropped and marked unsold.' });
});

/*  initial teams  */
const initialTeams = [
  'IMJ NINJAS','IMJ IGNITORS','IMJ TITANS','IMJ FALCONS','IMJ PHANTOMS','IMJ HAWKS',
];
async function ensureTeams() {
  for (const name of initialTeams) {
    const exists = await Team.exists({ name });
    if (!exists) await Team.create({ name });
  }
}

/* =================================================================
   DB + SERVER START
================================================================= */
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cricketAuction';

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  })
  .then(async () => {
    console.log('✅ MongoDB Connected');
    await ensureTeams();
    app.listen(PORT, () => console.log(`🚀 Server ready on http://localhost:${PORT}`));
  })
  .catch((err) => {
    //  safe log – never crashes on undefined again
    console.error('❌ MongoDB connection error:', err && err.stack ? err.stack : err);
    process.exit(1);
  });