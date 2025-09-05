const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  name: String,
  credits: { type: Number, default: 10000 },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: "Player" }],
});

module.exports = mongoose.model("Team", teamSchema);
