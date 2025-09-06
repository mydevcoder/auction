const mongoose = require("mongoose");

async function resetDB() {
  await mongoose.connect("mongodb://127.0.0.1:27017/cricketAuction");

  const Team = mongoose.model(
    "Team",
    new mongoose.Schema({
      name: String,
      credits: Number,
      usedCredits: Number,
      players: [mongoose.Schema.Types.ObjectId],
    })
  );
  const Player = mongoose.model(
    "Player",
    new mongoose.Schema({
      name: String,
      className: String,
      basePrice: Number,
      sold: Boolean,
      team: mongoose.Schema.Types.ObjectId,
      soldPrice: Number,
    })
  );
  const Auction = mongoose.model(
    "Auction",
    new mongoose.Schema({
      player: mongoose.Schema.Types.ObjectId,
      currentBid: Number,
      highestBidder: mongoose.Schema.Types.ObjectId,
    })
  );

  try {
    // Clear all players
    await Player.deleteMany({});
    // Clear all auctions
    await Auction.deleteMany({});
    // Reset all teams
    await Team.updateMany({}, { $set: { credits: 10000, usedCredits: 0, players: [] } });

    console.log("✅ Database cleared. Ready for fresh auction!");
  } catch (err) {
    console.error("❌ Error resetting DB:", err);
  } finally {
    mongoose.connection.close();
  }
}

resetDB();
