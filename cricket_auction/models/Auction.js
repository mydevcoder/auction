const mongoose = require("mongoose");

const auctionSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  currentBid: Number,
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }
});

module.exports = mongoose.model("Auction", auctionSchema);
